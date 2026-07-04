import { defineConfig } from '@prisma/config'

export default defineConfig({
  earlyAccess: true,
  studio: {
    port: 5555,
  },
  migrations: {
    url: 'file:./dev.db',
  }
})
