import json
from pydantic import BaseModel, conlist, root_validator, validator
from typing import List, Optional

from pylon.core.tools import log
from ...integrations.models.pd.integration import SecretField

from tools import rpc_tools, VaultClient


def get_token_limits():
    vault_client = VaultClient()
    secrets = vault_client.get_all_secrets()
    return json.loads(secrets.get('ai_dial_token_limits', ''))


class CapabilitiesModel(BaseModel):
    completion: bool = False
    chat_completion: bool = True
    embeddings: bool = False


class AIModel(BaseModel):
    id: str
    name: Optional[str]
    capabilities: CapabilitiesModel = CapabilitiesModel()
    token_limit: Optional[int]

    @validator('name', always=True, check_fields=False)
    def name_validator(cls, value, values):
        return values.get('model', value)

    @validator('token_limit', always=True, check_fields=False)
    def token_limit_validator(cls, value, values):
        if value:
            return value
        token_limits = get_token_limits()
        return token_limits.get(values.get('id'), 8096)


class IntegrationModel(BaseModel):
    api_token: SecretField | str
    model_name: str = 'gpt-35-turbo'
    models: List[AIModel] = []
    api_version: str = '2023-03-15-preview'
    api_base: str = "https://ai-proxy.lab.epam.com"
    api_type: str = "azure"
    temperature: float = 0
    max_tokens: int = 7
    top_p: float = 0.8

    @root_validator(pre=True)
    def prepare_model_list(cls, values):
        models = values.get('models')
        if models and isinstance(models[0], str):
            values['models'] = [AIModel(id=model, name=model).dict(by_alias=True) for model in models]
        return values

    @property
    def token_limit(self):
        return next((model.token_limit for model in self.models if model.id == self.model_name), 8096)

    def get_token_limit(self, model_name):
        return next((model.token_limit for model in self.models if model.id == model_name), 8096)

    def check_connection(self, project_id=None):
        from tools import session_project
        if not project_id:
            project_id = session_project.get()
        api_key = self.api_token.unsecret(project_id)
        api_type = self.api_type
        api_version = self.api_version
        api_base = self.api_base
        try:
            # openai < 1.0.0
            from openai import Model
            Model.list(
                api_key=api_key, api_base=api_base, api_type=api_type, api_version=api_version
                )
        except Exception as e:
            # openai >= 1.0.0
            try:
                from openai import AzureOpenAI
                client = AzureOpenAI(
                    base_url=api_base,
                    api_version=api_version,
                    api_key=api_key,
                    # api_type is removed in openai >= 1.0.0
                )
                client.models.list()
            except Exception as e:
                log.error(e)
                return str(e)
        return True

    def refresh_models(self, project_id):
        integration_name = 'ai_dial'
        payload = {
            'name': integration_name,
            'settings': self.dict(),
            'project_id': project_id
        }
        return getattr(rpc_tools.RpcMixin().rpc.call, f'{integration_name}_set_models')(payload)


class AIDialSettings(BaseModel):
    model_name: str = 'gpt-35-turbo'
    api_version: str = '2023-03-15-preview'
    api_base: str = "https://ai-proxy.lab.epam.com"
    temperature: float = 0
    max_tokens: int = 512
    top_p: float = 0.8
