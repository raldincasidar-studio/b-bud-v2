<template>
  <v-container class="my-10">
    <v-row justify="space-between">
      <v-col>
        <h2>Document Requests</h2>
      </v-col>
      <v-col class="text-right">
        <v-btn
          rounded
          size="large"
          variant="tonal"
          to="/documents/new"
          prepend-icon="mdi-file-document-plus"
          color="primary"
        >
          New Request
        </v-btn>
      </v-col>
    </v-row>

    <div class="my-10">
      <v-text-field
        v-model="searchKey"
        prepend-inner-icon="mdi-magnify"
        variant="outlined"
        color="primary"
        label="Search Documents"
        placeholder="Search for address, type, status, etc..."
        rounded="lg"
      ></v-text-field>

      <v-data-table-server
        :items-length="totalDocuments"
        :search="searchKey"
        :items="documents"
        @update:options="updateTable"
      >
        <template v-slot:item.status="{ value }">
          <v-chip
            :color="{
              Approved: 'green',
              Pending: 'orange',
              Rejected: 'red'
            }[value]"
            size="small"
          >
            {{ value }}
          </v-chip>
        </template>
        <template v-slot:item.action="{ item }">
          <v-btn
            variant="outlined"
            color="grey-darken-2"
            :to="`/documents/${item._id}`"
            prepend-icon="mdi-eye"
          >
            View
          </v-btn>
        </template>
      </v-data-table-server>
    </div>
  </v-container>
</template>

<script setup>
const searchKey = ref('');
const totalDocuments = ref(0);
const documents = ref([]);

async function updateTable(tableData) {
  const { data } = await useMyFetch('/api/documents', {
    query: {
      search: tableData.search,
      page: tableData.page,
      itemsPerPage: tableData.itemsPerPage,
    },
  });

  documents.value = data.value?.documents || [];
  totalDocuments.value = data.value?.totalDocuments || 0;
}
</script>
