<template>
  <v-container class="my-10">
    <v-row justify="space-between mb-10">
      <v-col><h2>{{ official.name }}</h2></v-col>
      <v-col class="text-right">
        <v-btn
          rounded
          size="large"
          variant="tonal"
          @click="deleteOfficial()"
          prepend-icon="mdi-delete"
          color="red"
          >Delete</v-btn
        >
        <v-btn
          :disabled="isLoading"
          rounded
          size="large"
          variant="tonal"
          @click="saveOfficial()"
          prepend-icon="mdi-account-plus"
          color="blue"
          >Save Official</v-btn
        >
      </v-col>
    </v-row>

    <v-card
      prepend-icon="mdi-account"
      title="Official Information"
      :loading="isLoading"
      :disabled="isLoading"
    >
      <v-card-item>
        <v-row>
          <v-col cols="12" class="text-center">
            <v-avatar size="150"><v-img :src="official.picture"></v-img></v-avatar>
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" sm="12" md="4">
            <v-text-field v-model="official.picture" label="Picture"></v-text-field>
          </v-col>
          <v-col cols="12" sm="12" md="4">
            <v-select
              v-model="official.zone"
              label="Zone"
              :items="['Zone 1', 'Zone 2', 'Zone 3']"
            ></v-select>
          </v-col>
          <v-col cols="12" sm="12" md="4">
            <v-text-field v-model="official.brgy" label="Barangay"></v-text-field>
          </v-col>
        </v-row>

        <v-row>
          <v-col cols="12" sm="12" md="4">
            <v-select
              v-model="official.designation"
              label="Designation"
              :items="['PB', 'K', 'A', 'G', 'A', 'W', 'A', 'D', 'SEC', 'TREAS']"
            ></v-select>
          </v-col>
          <v-col cols="12" sm="12" md="4">
            <v-text-field v-model="official.name" label="Name"></v-text-field>
          </v-col>
          <v-col cols="12" sm="12" md="4">
            <v-text-field v-model="official.blood_type" label="Blood Type"></v-text-field>
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
    picture: '',
    zone: '',
    brgy: '',
    designation: '',
    blood_type: ''
  })

  const route = useRoute();
  onMounted( async () => {

    const {data, error} = await useMyFetch('/api/officials/'+route.params.id);

    console.log(data.value);
    if (!data.value?.official) return;

    official.value.name = data.value?.official?.name;
    official.value.picture = data.value?.official?.picture;
    official.value.zone = data.value?.official?.zone;
    official.value.brgy = data.value?.official?.brgy;
    official.value.designation = data.value?.official?.designation;
    official.value.blood_type = data.value?.official?.blood_type;
  } )

  const isLoading = ref(false);
  const router = useRouter();
  async function saveOfficial() {

    isLoading.value = true;
    const {data, error, status} = await useMyFetch('/api/officials/'+route.params.id, {
      method: 'put',
      body: {
        ...official.value
      }
    })

    console.log(data);

    if (error.value) {
      isLoading.value = false;
      return;
    }

    router.push('/officials')
    $toast.fire({
      title: 'Official updated!',
      icon: 'success'
    })




  }

  async function deleteOfficial() {

    const {isConfirmed} = await new $swal({
        title: `Delete ${official.name}?`,
        text: 'This can not be reversed!',
        showCancelButton: true,
        confirmButtonText: 'Yes, delete it!',
        cancelButtonText: 'Cancel',
    })

    if (!isConfirmed) return;

    const deleteFetch = await useMyFetch('/api/officials/'+route.params.id, {
        method: 'delete'
    })

    if (deleteFetch.error.value) return;

    $toast.fire({
        title: 'Deleted!',
        icon: 'success',
    })
    router.replace('/officials')
}
</script>

