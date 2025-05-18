<script setup>
import { ref, onMounted } from "vue";
import { useMyFetch } from "../composables/useMyFetch";
const { $toast } = useNuxtApp();
const router = useRouter();

const route = useRoute();
const documentId = ref(route.params.id);  // Get the document ID from the route params
const residentId = ref("");
const address = ref("");
const type = ref("");
const yearsInBarangay = ref("");
const status = ref("Pending");
const description = ref("");
const purposeOfClearance = ref("");
const contactNumber = ref("");

const validId = ref(null);
const validIdBase64 = ref("");
const validIdName = ref("");

// Fetch the document data based on the documentId
onMounted(async () => {
  if (documentId.value) {
    try {
      const { data, error } = await useMyFetch(`/api/documents/${documentId.value}`);
      if (error.value || data?.value?.error) {
        return $toast.fire({
          title: data?.value?.error || 'Error fetching document data',
          icon: 'error',
        });
      }

      // Populate form fields with fetched data
      const document = data.value.document;
      residentId.value = document.residentId;
      address.value = document.Address;
      type.value = document.type;
      yearsInBarangay.value = document.YearsInBarangay;
      status.value = document.status;
      description.value = document.description;
      purposeOfClearance.value = document.PurposeOfDocument;
      contactNumber.value = document.ContactNumber;
      validIdBase64.value = document.validIdBase64;
      validIdName.value = document.validIdName;
    } catch (error) {
      console.error("Error fetching document data:", error);
      $toast.fire({
        title: 'Error fetching document data',
        icon: 'error',
      });
    }
  }
});

const convertToBase64 = (fileEvent) => {
  return new Promise((resolve, reject) => {
    const file = fileEvent.target?.files?.[0] || fileEvent;
    if (!file) return reject("No file selected");

    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const handleValidIdUpload = async (file) => {
  if (file) {
    try {
      validIdBase64.value = await convertToBase64(file);
      validIdName.value = file.name;
    } catch (error) {
      console.error("Error converting valid ID:", error);
      $toast.fire({ title: "Error processing Valid ID", icon: "error" });
      validId.value = null;
      validIdBase64.value = "";
      validIdName.value = "";
    }
  }
};

const updateDocument = async () => {
  const documentData = {
    residentId: residentId.value,
    Address: address.value,
    type: type.value,
    YearsInBarangay: parseInt(yearsInBarangay.value),
    status: status.value,
    description: description.value,
    PurposeOfDocument: purposeOfClearance.value,
    ContactNumber: contactNumber.value,
    validIdBase64: validIdBase64.value,
    validIdName: validIdName.value,
  };

  try {
    const { data, error } = await useMyFetch(`/api/documents/${documentId.value}`, {
      method: "put",
      body: documentData,
    });

    if (error.value || data?.value?.error)
      return $toast.fire({
        title: data?.value?.error || "Failed to update document request",
        icon: "error",
      });

    $toast.fire({
      title: data?.value?.message || "Document request updated successfully",
      icon: "success",
    });

    router.push("/documents");
  } catch (err) {
    console.error(err);
    $toast.fire({
      title: "An unexpected error occurred",
      icon: "error",
    });
  }
};

const deleteDocument = async () => {
  const confirmDelete = window.confirm("Are you sure you want to delete this document?");
  if (!confirmDelete) return;

  try {
    const { data, error } = await useMyFetch(`/api/documents/${documentId.value}`, {
      method: "delete",
    });

    if (error.value || data?.value?.error)
      return $toast.fire({
        title: data?.value?.error || "Failed to delete document request",
        icon: "error",
      });

    $toast.fire({
      title: data?.value?.message || "Document request deleted successfully",
      icon: "success",
    });

    router.push("/documents");
  } catch (err) {
    console.error(err);
    $toast.fire({
      title: "An unexpected error occurred",
      icon: "error",
    });
  }
};
</script>

<template>
  <v-container class="my-10">
    <v-row justify="space-between mb-10">
      <v-col><h2>Update Document Request</h2></v-col>
      <v-col class="text-right">
        <v-btn
          rounded
          size="large"
          variant="tonal"
          @click="updateDocument"
          prepend-icon="mdi-file-document-edit"
          color="primary"
        >
          Save Changes
        </v-btn>
        <v-btn
          rounded
          size="large"
          variant="tonal"
          @click="deleteDocument"
          prepend-icon="mdi-delete"
          color="error"
          class="ml-3"
        >
          Delete Document
        </v-btn>
      </v-col>
    </v-row>

    <v-card prepend-icon="mdi-file-document-outline" title="Request Details">
      <v-card-item>
        <v-row>
          <v-col cols="12">
            <v-autocomplete
              prepend-inner-icon="mdi-magnify"
              variant="outlined"
              color="primary"
              v-model:search="searchResidentQuery"
              @update:search="searchResidents"
              label="Search for Residents"
              placeholder="Search by name, contact number, or address..."
              v-model="residentId"
              :items="residentSearchResult"
              item-title="title"
              item-value="value"
              rounded="lg"
              @change="selectResident"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" sm="6" md="4">
            <v-text-field
              v-model="residentId"
              label="Resident ID"
            ></v-text-field>
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-text-field v-model="address" label="Address"></v-text-field>
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-select
              v-model="type"
              :items="[ 'Documents Request', 'Complaints Request', 'Asset Request' ]"
              label="Type"
            ></v-select>
          </v-col>
        </v-row>

        <v-row>
          <v-col cols="12" sm="6" md="4">
            <v-text-field
              v-model="yearsInBarangay"
              label="Years in Barangay"
              type="number"
            ></v-text-field>
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-select
              v-model="status"
              :items="['Pending', 'Approved', 'Rejected']"
              label="Status"
            ></v-select>
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-text-field
              v-model="contactNumber"
              label="Contact Number"
            ></v-text-field>
          </v-col>
        </v-row>

        <v-row>
          <v-col cols="12" md="6">
            <v-textarea v-model="description" label="Description"></v-textarea>
          </v-col>
          <v-col cols="12" md="6">
            <v-textarea
              v-model="purposeOfClearance"
              label="Purpose of Document Request"
            ></v-textarea>
          </v-col>
        </v-row>

        <v-row>
          <v-col cols="12">
            <v-file-input
              v-model="validId"
              label="Upload Valid ID"
              accept="image/*,application/pdf"
              @change="handleValidIdUpload"
            ></v-file-input>
            <small v-if="validIdName">Selected file: {{ validIdName }}</small>
          </v-col>
        </v-row>
      </v-card-item>
    </v-card>
    <v-card prepend-icon="mdi-file-document" title="Valid IDs Preview" class="mt-10">
      <v-card-item class="py-5">
        <v-row>
          <v-col cols="12" sm="6" md="4">
            <v-sheet aspect-ratio="1/1" class="pa-3" color="grey-lighten-3 rounded-lg">
              <v-img :src="validIdBase64" aspect-ratio="16/9"></v-img>
            </v-sheet>
          </v-col>
        </v-row>
      </v-card-item>
    </v-card>
  </v-container>
</template>
