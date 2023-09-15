const AiDialIntegrationModal = {
    delimiters: ['[[', ']]'],
    props: ['instance_name', 'display_name', 'logo_src', 'section_name'],
    emits: ['update'],
    components: {
        'load-models-button': LoadModelsButton,
    },
    template: `
<div
        :id="modal_id"
        class="modal modal-small fixed-left fade shadow-sm" tabindex="-1" role="dialog"
        @dragover.prevent="modal_style = {'height': '300px', 'border': '2px dashed var(--basic)'}"
        @drop.prevent="modal_style = {'height': '100px', 'border': ''}"
>
    <ModalDialog
            v-model:name="config.name"
            v-model:is_shared="config.is_shared"
            v-model:is_default="is_default"
            @update="update"
            @create="create"
            :display_name="display_name"
            :id="id"
            :is_fetching="is_fetching"
            :is_default="is_default"
    >
        <template #body>
            <div class="form-group">
                <h9>Secret API Key</h9>
                  <SecretFieldInput
                        v-model="api_token"
                        placeholder="Open AI Token"
                 />
                <div class="invalid-feedback">[[ error.api_token ]]</div>
            </div>
            <div class="form-group">
                <p class="font-h5 font-semibold">API Base</p>
                <div class="custom-input custom-input__sm mb-3 mt-1" :class="{ 'invalid-input': isInvalid }">
                    <input type="text" placeholder="API Base"
                    v-model="api_base">
                    <span class="input_error-msg"></span>
                </div>
            </div>
            <div class="form-group">
                <p class="font-h5 font-semibold">API Version</p>
                <div class="custom-input custom-input__sm mb-3 mt-1" :class="{ 'invalid-input': isInvalid }">
                    <input type="text" placeholder="API Version"
                    v-model="api_version">
                    <span class="input_error-msg"></span>
                </div>
            </div>
            <div>
            <span :class="{ 'is-invalid': error.models }" class="font-h5 font-semibold">Models:</span>
            </div>
            <div>
                <button class="btn btn btn-painted mr-1 rounded-pill mb-1" v-for="model in models"
                    >[[ model ]]
                </button>
                <div class="invalid-feedback">[[ error.models ]]</div>
            </div>
            <load-models-button
                    ref="LoadModelsButton"
                    :pluginName="pluginName"
                    :error="error.check_connection"
                    :body_data="body_data"
                    v-model:models="models"
                    @handleError="handleError"
            >
            </load-models-button>
        </template>
        <template #footer>
            <test-connection-button
                    :apiPath="this.$root.build_api_url('integrations', 'check_settings') + '/' + pluginName"
                    :error="error.check_connection"
                    :body_data="body_data"
                    v-model:is_fetching="is_fetching"
                    @handleError="handleError"
            >
            </test-connection-button>
        </template>

    </ModalDialog>
</div>
    `,
    data() {
        return this.initialState()
    },
    mounted() {
        this.modal.on('hidden.bs.modal', e => {
            this.clear()
        })
    },
    watch: {
        api_base(newState, oldState) {
            this.models = []
        }
    },
    computed: {
        project_id() {
            return getSelectedProjectId()
        },
        body_data() {
            const {
                api_token,
                api_base,
                api_version,
                models,
                project_id,
                config,
                is_default,
                status,
                mode
            } = this
            return {
                api_token,
                api_base,
                api_version,
                models,
                project_id,
                config,
                is_default,
                status,
                mode
            }
        },
        modal() {
            return $(this.$el)
        },
        modal_id() {
            return `${this.instance_name}_integration`
        }
    },
    methods: {
        clear() {
            Object.assign(this.$data, this.initialState())
            this.$refs.LoadModelsButton.clear();
        },
        load(stateData) {
            Object.assign(this.$data, stateData)
        },
        handleEdit(data) {
            const {config, is_default, id, settings} = data
            this.load({...settings, config, is_default, id})
            this.modal.modal('show')
        },
        handleDelete(id) {
            this.load({id})
            this.delete()
        },
        create() {
            this.is_fetching = true
            fetch(this.api_url + this.pluginName, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(this.body_data)
            }).then(response => {
                this.is_fetching = false
                if (response.ok) {
                    this.modal.modal('hide')
                    this.$emit('update', {...this.$data, section_name: this.section_name})
                } else {
                    this.handleError(response)
                }
            })
        },
        handleError(response) {
            try {
                response.json().then(
                    errorData => {
                        errorData.forEach(item => {
                            this.error = {[item.loc[0]]: item.msg}
                        })
                    }
                )
            } catch (e) {
                alertMain.add(e, 'danger-overlay')
            }
        },
        update() {
            this.is_fetching = true
            fetch(this.api_url + this.id, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(this.body_data)
            }).then(response => {
                this.is_fetching = false
                if (response.ok) {
                    this.modal.modal('hide')
                    this.$emit('update', {...this.$data, section_name: this.section_name})
                } else {
                    this.handleError(response)
                }
            })
        },
        delete() {
            this.is_fetching = true
            fetch(this.api_url + this.project_id + '/' + this.id, {
                method: 'DELETE',
            }).then(response => {
                this.is_fetching = false
                if (response.ok) {
                    delete this.$data['id']
                    this.$emit('update', {...this.$data, section_name: this.section_name})
                } else {
                    this.handleError(response)
                    alertMain.add(`
                        Deletion error.
                        <button class="btn btn-primary"
                            onclick="vueVm.registered_components.${this.instance_name}.modal.modal('show')"
                        >
                            Open modal
                        <button>
                    `)
                }
            })
        },
        initialState: () => ({
            modal_style: {'height': '100px', 'border': ''},
            api_token: "",
            api_base: "https://ai-proxy.lab.epam.com",
            api_version: "2023-03-15-preview",
            // model: 'gpt-35-turbo',
            models: [],
            is_default: false,
            is_fetching: false,
            config: {},
            error: {},
            id: null,
            pluginName: 'ai_dial',
            api_url: V.build_api_url('integrations', 'integration') + '/',
            status: integration_status.success,
            mode: V.mode,
        })
    }
}
register_component('AiDialIntegrationModal', AiDialIntegrationModal)