<template>
    <v-container class="my-10">
        <v-row justify="space-between">
          <v-col><h2>Itenerary Report</h2></v-col>
        </v-row>




        <!-- Your content goes here -->
        <div class="my-10">
          <v-text-field v-model="searchKey" prepend-inner-icon="mdi-magnify" variant="outlined" color="primary" label="Search Products" placeholder="Search for Account ID, Name, Collector, etc..." rounded="lg"></v-text-field>


          <v-data-table-server :items-length="totalCustomers" :search="searchKey" :items="customers" @update:options="updateTable">
            <template v-slot:item.past_due="item">
              {{ item.item.past_due }}th day of month
            </template>
            <template v-slot:item.hasPastDue="item">
              <span v-if="item.item.hasPastDue.length > 0">
                <v-chip class="ma-1" color="red" size="small" v-for="i in item.item.hasPastDue">{{ i.due_month }} (Paid: {{ new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(i.totalPaid) }})</v-chip>
              </span>
              <v-chip class="ma-1" v-else color="green" size="small">No Past Dues</v-chip>
            </template>
            <template v-slot:item.action="item">
              <v-btn variant="outlined" color="grey-darken-2" :to="`/employees/${item.item.id}`" prepend-icon="mdi-eye">View</v-btn>
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
const totalCustomers = ref(0);
const customers = ref([
  // {
  //   "Name": "Raldin Casidar",
  //   "role": "Administrator",
  //   "username": "raldincasidar",
  //   "lastLogin": "Yesterday",
  //   "action": ""
  // },
])

async function getData() {

  
}

async function updateTable(tableData) {
  console.log(tableData);

  const {data, error} = await useMyFetch('/api/itenerary', {
    query: {
      search: tableData.search,
      page: tableData.page,
      itemsPerPage: tableData.itemsPerPage
    }
  });

  customers.value = data.value.data;
  totalCustomers.value = data.value.pagination.total
  console.log(data.value.data);
}
</script>