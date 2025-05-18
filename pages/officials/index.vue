<template>
    <v-container class="my-10">
        <v-row justify="space-between">
            <v-col><h2>Officials</h2></v-col>
            <v-col class="text-right"><v-btn rounded size="large" variant="tonal" to="/officials/new" prepend-icon="mdi-account-plus" color="primary">New Official</v-btn></v-col>
        </v-row>

        <!-- Your content goes here -->
        <div class="my-10">
            <v-text-field v-model="searchKey" prepend-inner-icon="mdi-magnify" variant="outlined" color="primary" label="Search Officials" placeholder="Search by Name, Zone, etc..." rounded="lg"></v-text-field>

            <v-data-table-server :items-length="totalOfficials" :search="searchKey" :items="officials" @update:options="updateTable">
                <template v-slot:item.action="{item}">
                    <v-btn variant="outlined" color="grey-darken-2" :to="`/officials/${item._id}`" prepend-icon="mdi-eye">View</v-btn>
                </template>
            </v-data-table-server>
        </div>
    </v-container>
</template>

<script setup>
const searchKey = ref('')
const totalOfficials = ref(0);
const officials = ref([])

const columns = [
    { text: 'Picture', value: 'picture' },
    { text: 'Zone', value: 'zone' },
    { text: 'Barangay', value: 'brgy' },
    { text: 'Designation', value: 'designation' },
    { text: 'Name', value: 'name' },
    { text: 'Blood Type', value: 'blood_type' },
]

async function updateTable(tableData) {
    console.log(tableData);

    const { data, error } = await useMyFetch('/api/officials', {
        query: {
            search: tableData.search,
            page: tableData.page,
            itemsPerPage: tableData.itemsPerPage
        }
    });

    officials.value = data.value.officials;
    totalOfficials.value = data.value.totalOfficials;
    console.log(data.value.data);
}
</script>
