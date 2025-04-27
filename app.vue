<template>
    <NuxtLayout>
        <v-app>
            <transition name="fade" mode="out-in">
                <NuxtPage />
            </transition>
        </v-app>
    </NuxtLayout>
</template>

<style>
.fade-enter-active, .fade-leave-active {
    transition: opacity 0.2s;
}
.fade-enter, .fade-leave-to /* .fade-leave-active in <2.1.8 */ {
    opacity: 0;
}
</style>
