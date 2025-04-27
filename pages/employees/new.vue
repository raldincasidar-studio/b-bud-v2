<template>
  <v-container class="my-10">
    <v-row justify="space-between mb-10">
      <v-col><h2>Add New Employee</h2></v-col>
      <v-col class="text-right"
        ><v-btn
          :disabled="isLoading"
          rounded
          size="large"
          variant="tonal"
          @click="saveEmployee()"
          prepend-icon="mdi-account-plus"
          color="primary"
          >Save Employee</v-btn
        ></v-col
      >
    </v-row>

    <v-card prepend-icon="mdi-account" title="User Information" :loading="isLoading" :disabled="isLoading">
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
            <v-text-field v-model="employee.username" label="Username"></v-text-field>
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

const isLoading = ref(false);
const router = useRouter();
async function saveEmployee() {

  isLoading.value = true;
  const {data, error, status} = await useMyFetch('/api/employees', {
    method: 'post', 
    body: {
      ...employee.value
    }
  })

  console.log(data);

  if (data.error) {
    isLoading.value = false;
    return;
  }

  router.push('/employees')
  $toast.fire({
    title: 'Employee added!',
    icon: 'success'
  })




}

</script>

