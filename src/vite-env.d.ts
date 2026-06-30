/// <reference types="vite/client" />

// Vuetify ships its styles entry without type declarations; declare it so vue-tsc (TS 6.x)
// doesn't fail on the side-effect import in src/plugins/vuetify.ts.
declare module 'vuetify/styles'
