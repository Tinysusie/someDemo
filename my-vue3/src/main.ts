import './assets/main.css'

import { createApp, type DirectiveBinding } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'

import App from './App.vue'
import router from './router'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(ElementPlus, { size: 'small', zIndex: 3000 })

app.directive('permission', {
  mounted(el: HTMLElement, binding: DirectiveBinding<string | string[]>) {
    // Implementation for the permission directive
    const { value } = binding
    const userPermissions = ['read', 'write'] // Example user permissions
    if (
      value &&
      ((Array.isArray(value) &&
        !value.some((permission) => userPermissions.includes(permission))) ||
        (!Array.isArray(value) && !userPermissions.includes(value)))
    ) {
      el.style.display = 'none' // Remove the element if the user does not have the required permission
    }
  },
})
app.directive('highlight', {
  mounted(el: HTMLElement) {
    el.style.color = '#42b883'
  },
})

app.mount('#app')
