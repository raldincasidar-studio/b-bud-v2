<template>
    <v-container class="text-center" max-width="800">
        <h1 class="text-h2 text-bold my-2 mt-12">B-Bud</h1>
        <h3 class="my-5">Welcome {{ userData?.name }}!</h3>

        <h2 class="mb-10 mt-15">Let's start your work!</h2>

        <v-row align-content="stretch">
          <v-col cols="12" sm="12" md="6" lg="4" v-for="item in items">
            <v-card :to="item.to" rounded="lg" elevation="3" class="text-left py-4 px-4 h-100 cursor-pointer" v-ripple>
              <v-card-text class="h-100 d-flex flex-column justify-space-between">
                <v-avatar color="primary" variant="tonal" size="60">
                  <v-icon :icon="item.icon" size="30"></v-icon>
                </v-avatar>
                <h2 class="mt-5 text-black font-weight-regular">{{ item.text }}</h2>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
    </v-container>
</template>

<script setup>

const userData = useCookie('userData');

const items = [
    { to: '/residents', text: 'Residents', icon: 'mdi-account-group' },
    { to: '/households', text: 'Households', icon: 'mdi-home-group' },
    { to: '/admins', text: 'Admins', icon: 'mdi-shield-account' },
    { to: '/documents', text: 'Documents', icon: 'mdi-file-document' },
    { to: '/officials', text: 'Officials', icon: 'mdi-bank' },
    { to: '/notifications', text: 'Notifications', icon: 'mdi-bell-ring' },
  ]
</script>