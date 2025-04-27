<template>
  <v-container class="my-10">
    <v-row justify="space-between mb-10">
      <v-col><h2>{{ employee.name }}</h2></v-col>
      <v-col class="text-right">
        <v-btn
          rounded
          size="large"
          variant="tonal"
          @click="deleteEmployee()"
          prepend-icon="mdi-delete"
          color="red"
          >Delete</v-btn
        >
        <v-btn
          :disabled="isLoading"
          rounded
          size="large"
          variant="tonal"
          @click="saveEmployee()"
          prepend-icon="mdi-account-plus"
          color="blue"
          >Save Employee</v-btn
        >
      </v-col>
    </v-row>

    <v-card
      prepend-icon="mdi-account"
      title="User Information"
      :loading="isLoading"
      :disabled="isLoading"
    >
      <v-card-item>
        <v-row>
          <v-col cols="12" sm="12" md="6">
            <v-text-field v-model="employee.name" label="Name"></v-text-field>
          </v-col>
          <v-col cols="12" sm="12" md="6">
            <v-select
              v-model="employee.role"
              label="Role"
              :items="['Administrator', 'Receptionist', 'Collector']"
            ></v-select>
          </v-col>
        </v-row>

        <v-row>
          <v-col cols="12" sm="12" md="12">
            <v-text-field
              v-model="employee.username"
              label="Username"
            ></v-text-field>
          </v-col>
        </v-row>

        <v-row>
          <v-col cols="12" sm="12" md="6">
            <v-text-field
              v-model="employee.password"
              label="Password"
              type="password"
              append-inner-icon="mdi-eye"
            ></v-text-field>
          </v-col>
          <v-col cols="12" sm="12" md="6">
            <v-text-field
              v-model="employee.confirmPassword"
              label="Confirm Password"
              type="password"
              append-inner-icon="mdi-eye"
            ></v-text-field>
          </v-col>
        </v-row>
      </v-card-item>
    </v-card>
  </v-container>
</template>

<script setup>
  const { $swal, $toast } = useNuxtApp();


  const employee = ref({
    name: '',
    role: '',
    username: '',
    password: '',
    confirmPassword: ''
  })

  const route = useRoute();
  onMounted( async () => {

    const {data, error} = await useMyFetch('/api/employees/'+route.params.id);

    console.log(data.value);
    if (!data.value?.employee) return;

    employee.value.name = data.value?.employee?.name;
    employee.value.role = data.value?.employee?.role;
    employee.value.username = data.value?.employee?.username;
  } )

  const isLoading = ref(false);
  const router = useRouter();
  async function saveEmployee() {

    isLoading.value = true;
    const {data, error, status} = await useMyFetch('/api/employees/'+route.params.id, {
      method: 'put',
      body: {
        ...employee.value
      }
    })

    console.log(data);

    if (error.value) {
      isLoading.value = false;
      return;
    }

    router.push('/employees')
    $toast.fire({
      title: 'Employee updated!',
      icon: 'success'
    })




  }

  async function deleteEmployee() {

    const {isConfirmed} = await new $swal({
        title: `Delete ${employee.username}?`,
        text: 'This can not be reversed!',
        showCancelButton: true,
        confirmButtonText: 'Yes, delete it!',
        cancelButtonText: 'Cancel',
    })

    if (!isConfirmed) return;

    const deleteFetch = await useMyFetch('/api/employees/'+route.params.id, {
        method: 'delete'
    })

    if (deleteFetch.error.value) return;

    $toast.fire({
        title: 'Deleted!',
        icon: 'success',
    })
    router.replace('/employees')
}
</script>
