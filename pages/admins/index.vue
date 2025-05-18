<template>
  <v-container class="my-10">
      <v-row justify="space-between">
        <v-col><h2>Admins</h2></v-col>
        <v-col class="text-right"><v-btn rounded size="large" variant="tonal" to="/admins/new" prepend-icon="mdi-account-plus" color="primary">New Admin</v-btn></v-col>
      </v-row>

      <!-- Your content goes here -->
      <div class="my-10">
        <v-text-field v-model="searchKey" prepend-inner-icon="mdi-magnify" variant="outlined" color="primary" label="Search Admins" placeholder="Search for Username, Name, Role, etc..." rounded="lg"></v-text-field>

        <v-data-table-server :items-length="totalAdmins" :search="searchKey" :items="admins" @update:options="updateTable">
          <template v-slot:item.action="{item}">
            <!-- {{ value }} -->
            <v-btn variant="outlined" color="grey-darken-2" :to="`/admins/${item._id}`" prepend-icon="mdi-eye">View</v-btn>
          </template>
        </v-data-table-server>
      </div>
  </v-container>
</template>

<script setup>
const items = [
  { to: '/dashboard', text: 'Dashboard', icon: 'mdi-speedometer' },
  { to: '/customers', text: 'Customers', icon: 'mdi-account-group' },
  { to: '/inventory', text: 'Inventory', icon: 'mdi-package-variant' },
  { to: '/employees', text: 'Employees', icon: 'mdi-card-account-details-outline' },
  { to: '/itenerary', text: 'Itenerary Reports', icon: 'mdi-finance' },
  { to: '/', text: 'Logout', icon: 'mdi-logout' },
]

const searchKey = ref('')
const totalAdmins = ref(0);
const admins = ref([])

async function updateTable(tableData) {
console.log(tableData);

const {data, error} = await useMyFetch('/api/admins', {
  query: {
    search: tableData.search,
    page: tableData.page,
    itemsPerPage: tableData.itemsPerPage
  }
});

console.log(data);
console.log(data.value?.data);

admins.value = data.value?.admins;
totalAdmins.value = data.value?.totalAdmins
}
</script>
