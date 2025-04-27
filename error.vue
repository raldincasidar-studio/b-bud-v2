<template>
    <v-container min-height="100vh">
        <v-row class="fill-height" align-sm="top" align-md="center">
            <v-col cols="12" sm="12" md="12" class="align-center d-flex d-md-block">
                <v-card max-width="400" class="mx-auto" flat>
                    <v-card-text>

                        <div class="mt-12 text-center d-block">
                            <v-icon size="100" color="grey">mdi-alert-circle-outline</v-icon>
                            <h2 class="text-bold my-2 text-primary">Oops! This page does not exist</h2>
                            <p>This page might be under development or is temporarily unavailable</p>
                        </div>
                        <v-btn to="/" block class="mt-10" color="primary" size="large">Go Back</v-btn>
                    </v-card-text>
                </v-card>
            </v-col>
        </v-row>
    </v-container>
</template>

<script setup>
const { $toast } = useNuxtApp();

definePageMeta({
  layout: 'login-layout'
})

</script>