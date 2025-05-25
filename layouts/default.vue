<template>
    <v-layout class="rounded rounded-md border">
        <v-navigation-drawer v-model="drawer">
            <v-list>
                <v-list-item
                    prepend-icon="mdi-account"
                    :subtitle="userData?.role"
                    :title="userData?.name"
                >
                    <template v-slot:append>
                    <v-btn
                        icon="mdi-menu-down"
                        size="medium"
                        variant="text"
                    ></v-btn>
                    </template>
                </v-list-item>
                </v-list>

                <v-divider></v-divider>

                <v-list
                :lines="false"
                nav
                >
                <v-list-item
                    v-for="(item, i) in itemsFiltered"
                    :to="item.to"
                    :key="i"
                    :value="item"
                    color="primary"
                >
                    <template v-slot:prepend>
                    <v-icon :icon="item.icon"></v-icon>
                    </template>

                    <v-list-item-title v-text="item.text"></v-list-item-title>
                </v-list-item>
                <v-list-item
                    @click="logout()"
                    color="primary"
                >
                    <template v-slot:prepend>
                    <v-icon icon="mdi-logout"></v-icon>
                    </template>

                    <v-list-item-title v-text="'Logout'"></v-list-item-title>
                </v-list-item>
            </v-list>
        </v-navigation-drawer>

        <v-app-bar color="primary">
            <v-app-bar-nav-icon variant="text" @click.stop="drawer = !drawer"></v-app-bar-nav-icon>
            <v-toolbar-title>B-Bud</v-toolbar-title>
        </v-app-bar>

        <v-main>
            <slot />
        </v-main>
    </v-layout>
</template>

<script setup>

const userData = useCookie('userData');

const drawer = ref(false);
const items = [
    { to: '/dashboard', text: 'Dashboard', icon: 'mdi-speedometer' },
    { to: '/residents', text: 'Residents', icon: 'mdi-account-group' },
    { to: '/households', text: 'Households', icon: 'mdi-home-group' },
    { to: '/admins', text: 'Admins', icon: 'mdi-shield-account', superAdmin: true },
    { to: '/documents', text: 'Documents', icon: 'mdi-file-document' },
    { to: '/officials', text: 'Officials', icon: 'mdi-bank' },
    { to: '/notifications', text: 'Notifications', icon: 'mdi-bell-ring' },
  ]

  const router = useRouter();
async function logout() {
    userData.value = null;
    router.replace('/')
}

const itemsFiltered = computed(() => {
    return items.filter(item => !item.superAdmin || userData.value?.role === 'Superadmin');
})
</script>