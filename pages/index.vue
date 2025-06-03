c<template>
    <v-container min-height="100vh">
        <v-row class="fill-height" align-sm="top" align-md="center">
            <v-col cols="12" sm="12" md="12" class="align-center d-flex d-md-block">
                <v-card max-width="400" class="mx-auto" flat>
                    <v-card-text>

                        <div class="mb-12 text-center d-block">
                            <v-img src="@/assets/img/logo.png" width="100" class="mx-auto"></v-img>
                            <h2 class="text-bold my-2 text-primary">B-Bud v2</h2>
                            <p>Administrator Login Portal</p>
                        </div>

                        <v-text-field v-model="username" prepend-inner-icon="mdi-account" variant="outlined" color="primary" label="Username"></v-text-field>
                        <v-text-field v-model="password" prepend-inner-icon="mdi-key" variant="outlined" color="primary" label="Password" type="password"></v-text-field>
                        
                        <v-btn @click="login()" :loading="isLoading" :disabled="isLoading" block class="mt-2" color="primary" size="large">Login</v-btn>
                        <p class="my-5 d-flex justify-space-between">
                            <a class="text-grey text-decoration-none pa-1 d-inline-block" v-ripple href="#!">Can't Log in? Contact Technical Admin</a>
                            <a class="text-grey text-decoration-none pa-1 d-inline-block" v-ripple href="#!"></a>
                        </p>
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


const isLoading = ref(false);
const username = ref('');
const password = ref('');

const router = useRouter();
async function login() {
    isLoading.value = true;
    const {data, error} = await useMyFetch('/api/login', {
        method: 'post',
        body: {
            username: username.value,
            password: password.value
        }
    })

    if (data.value?.error || error.value) {
        isLoading.value = false;
        $toast.fire({
            title: data.value?.error || 'Invalid username or password',
            icon: 'error'
        })
        return;
    }

    let userData = useCookie('userData');
    console.log(data.value?.user)
    userData.value = {...data.value?.user, token: data.value?.token};

    $toast.fire({
        title: `Welcome ${data.value?.user?.name}!`,
        icon: 'success'
    })

    router.replace('/dashboard');
    isLoading.value = false;
}
</script>