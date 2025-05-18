<template>
  <v-container class="my-10">
    <v-row justify="space-between mb-10">
      <v-col><h2>Add New Official</h2></v-col>
      <v-col class="text-right"
        ><v-btn
          :disabled="isLoading"
          rounded
          size="large"
          variant="tonal"
          @click="saveOfficial()"
          prepend-icon="mdi-account-plus"
          color="primary"
          >Save Official</v-btn
        ></v-col
      >
    </v-row>

    <v-card prepend-icon="mdi-account" title="Official Information" :loading="isLoading" :disabled="isLoading">
      <v-card-item>
        <v-row>
          <v-col cols="12" class="text-center" v-if="official?.picture">
            <v-avatar size="150" class="my-4"><v-img :src="official.picture"></v-img></v-avatar>
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" sm="12" md="6">
            <v-text-field v-model="official.name" label="Name"></v-text-field>
          </v-col>
          <v-col cols="12" sm="12" md="6">
            <v-select
              v-model="official.designation"
              label="Designation"
              :items="['PB', 'K', 'A', 'G', 'A', 'W', 'A', 'D', 'SEC', 'TREAS']"
            ></v-select>
          </v-col>
        </v-row>

        <v-row>
          <v-col cols="12" sm="6" md="4">
            <v-text-field v-model="official.zone" label="Zone"></v-text-field>
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-text-field v-model="official.brgy" label="Barangay"></v-text-field>
          </v-col>
          <v-col cols="12" sm="12" md="4">
            <v-text-field v-model="official.blood_type" label="Blood Type"></v-text-field>
          </v-col>
        </v-row>

        <v-row>
          <v-col cols="12">
            <v-file-input
              v-model="official.picture"
              label="Picture"
              accept="image/*"
              prepend-icon="mdi-camera"
              @change="convertPictureToBase64"
            >
            </v-file-input>
          </v-col>
        </v-row>
      </v-card-item>
    </v-card>
  </v-container>
</template>

<script setup>
const { $swal, $toast } = useNuxtApp();

const official = ref({
  name: '',
  designation: '',
  zone: '',
  brgy: '',
  blood_type: '',
  picture: null
})

const isLoading = ref(false);
const router = useRouter();

async function convertPictureToBase64(file) {
  if (!file) {
    official.value.picture = null;
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    official.value.picture = e.target.result;
  };

  console.log(file.target.files[0]);
  reader.readAsDataURL(file.target.files[0]);
}

async function saveOfficial() {
  isLoading.value = true;
  const {data, error, status} = await useMyFetch('/api/officials', {
    method: 'post', 
    body: {
      ...official.value
    }
  })

  console.log(data);

  if (data.value.error) {
    isLoading.value = false;
    $toast.fire({
      title: data.value.error,
      icon: 'error'
    })
    return;
  }

  router.push('/officials')
  $toast.fire({
    title: 'Official added!',
    icon: 'success'
  })
}
</script>

