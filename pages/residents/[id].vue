<script setup>
import { ref, onMounted } from "vue";
import { useMyFetch } from "../composables/useMyFetch";
const { $toast } = useNuxtApp();
const router = useRouter();

const route = useRoute();
const residentId = ref(null);

const firstName = ref("");
const middleName = ref("");
const lastName = ref("");
const gender = ref("");
const dateOfBirth = ref("");
const civilStatus = ref("");
const subdivision = ref("");
const block = ref("");
const lot = ref("");
const yearLived = ref("");
const occupation = ref("");
const isVoter = ref("");
const contactNo = ref("");
const emailAddress = ref("");
const proofOfResidency = ref(null);
const proofOfResidencyBase64 = ref("");
const proofOfResidencyName = ref("");
const proofOfResidencyPreview = ref("");

onMounted(async () => {
  residentId.value = route.params.id;
  if (residentId.value) {
    try {
      const { data, error } = await useMyFetch(`/api/residents/${residentId.value}`);
      if (error.value || data?.value?.error) {
        return $toast.fire({
          title: data?.value?.error || 'Error fetching resident data',
          icon: 'error',
        });
      }

      const resident = data.value.resident;
      firstName.value = resident.firstName;
      middleName.value = resident.middleName;
      lastName.value = resident.lastName;
      gender.value = resident.gender;
      dateOfBirth.value = resident.dateOfBirth;
      civilStatus.value = resident.civilStatus;
      subdivision.value = resident.subdivision;
      block.value = resident.block;
      lot.value = resident.lot;
      yearLived.value = resident.yearLived;
      occupation.value = resident.occupation;
      isVoter.value = resident.isVoter;
      contactNo.value = resident.contactNo;
      emailAddress.value = resident.emailAddress;
      proofOfResidencyPreview.value = resident.proofOfResidency;
      // We don't populate proofOfResidencyBase64 or proofOfResidencyName here
      // as it's likely a file path or stored differently on the backend.
      // If you need to display the existing file, you'd need a different approach.
    } catch (error) {
      console.error("Error fetching resident:", error);
      $toast.fire({
        title: 'Error fetching resident data',
        icon: 'error',
      });
    }
  }
});

const convertToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    console.log('Reading file: ', file.target.files[0]);
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file.target.files[0]);
  });
};

const handleFileUpload = async (file) => {
  if (file) {
    try {
      proofOfResidencyBase64.value = await convertToBase64(file);
      proofOfResidencyPreview.value = proofOfResidencyBase64.value;
      proofOfResidencyName.value = file.name;
    } catch (error) {
      console.error("Error converting file to Base64:", error);
      $toast.fire({
        title: 'Error processing file',
        icon: 'error',
      });
      proofOfResidency.value = null; // Reset the file input
      proofOfResidencyBase64.value = "";
      proofOfResidencyName.value = "";
    }
  } else {
    proofOfResidencyBase64.value = "";
    proofOfResidencyName.value = "";
  }
};

const saveResident = async () => {
  const apiUrl = residentId.value ? `/api/residents/${residentId.value}` : "/api/residents";
  const method = residentId.value ? 'put' : 'post';

  const residentData = {
    firstName: firstName.value,
    middleName: middleName.value,
    lastName: lastName.value,
    gender: gender.value,
    dateOfBirth: dateOfBirth.value,
    civilStatus: civilStatus.value,
    subdivision: subdivision.value,
    block: block.value,
    lot: lot.value,
    yearLived: yearLived.value,
    occupation: occupation.value,
    isVoter: isVoter.value,
    contactNo: contactNo.value,
    emailAddress: emailAddress.value,
    proofOfResidency: proofOfResidencyBase64.value,
    proofOfResidencyName: proofOfResidencyName.value,
  };

  try {
    const { data, error } = await useMyFetch(apiUrl, {
      method: method,
      body: residentData,
    });

    if (error.value || data?.value?.error) return $toast.fire({
      title: data?.value?.error || `Something went wrong ${residentId.value ? 'updating' : 'adding'} resident`,
      icon: 'error',
    });

    $toast.fire({
      title: data?.value?.message || `Resident ${residentId.value ? 'updated' : 'added'} successfully`,
      icon: 'success',
    });
    router.push('/residents'); // Assuming you have a residents list page
  } catch (error) {
    console.error(error);
    $toast.fire({
      title: `Something went wrong ${residentId.value ? 'updating' : 'adding'} resident`,
      icon: 'error',
    });
  }
};

const deleteResident = async () => {
  if (!residentId.value) return;

  if (confirm('Are you sure you want to delete this resident?')) {
    try {
      const { data, error } = await useMyFetch(`/api/residents/${residentId.value}`, {
        method: 'delete',
      });

      if (error.value || data?.value?.error) return $toast.fire({
        title: data?.value?.error || 'Something went wrong while deleting resident',
        icon: 'error',
      });

      $toast.fire({
        title: data?.value?.message || 'Resident deleted successfully',
        icon: 'success',
      });
      router.push('/residents'); // Redirect after successful deletion
    } catch (error) {
      console.error("Error deleting resident:", error);
      $toast.fire({
        title: 'Something went wrong while deleting resident',
        icon: 'error',
      });
    }
  }
};
</script>

<template>
  <v-container class="my-10">
    <v-row justify="space-between mb-10">
      <v-col><h2>{{ residentId ? 'Update Resident' : 'Add New Resident' }}</h2></v-col>
      <v-col class="text-right">
        <v-btn
          v-if="residentId"
          rounded
          size="large"
          variant="tonal"
          color="error"
          prepend-icon="mdi-delete"
          class="mr-2"
          @click="deleteResident"
        >
          Delete Resident
        </v-btn>
        <v-btn
          rounded
          size="large"
          variant="tonal"
          @click="saveResident"
          :prepend-icon="residentId ? 'mdi-content-save-edit' : 'mdi-account-plus'"
          color="primary"
        >
          {{ residentId ? 'Save Update' : 'Add Resident' }}
        </v-btn>
      </v-col>
    </v-row>

    <v-card prepend-icon="mdi-account-circle" title="Personal Information">
      <v-card-item>
        <v-row>
          <v-col cols="12" sm="6" md="4">
            <v-text-field v-model="firstName" label="First Name"></v-text-field>
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-text-field v-model="middleName" label="Middle Name"></v-text-field>
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-text-field v-model="lastName" label="Last Name"></v-text-field>
          </v-col>
        </v-row>

        <v-row>
          <v-col cols="12" sm="6" md="4">
            <v-select
              v-model="gender"
              :items="['Male', 'Female', 'Other']"
              label="Gender"
            ></v-select>
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-text-field
              v-model="dateOfBirth"
              label="Date of Birth"
              type="date"
            ></v-text-field>
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-select
              v-model="civilStatus"
              :items="['Single', 'Married', 'Divorced', 'Widowed', 'Separated']"
              label="Civil Status"
            ></v-select>
          </v-col>
        </v-row>

        <v-row>
          <v-col cols="12" sm="6" md="4">
            <v-text-field v-model="subdivision" label="Subdivision"></v-text-field>
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-text-field v-model="block" label="Block"></v-text-field>
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-text-field v-model="lot" label="Lot"></v-text-field>
          </v-col>
        </v-row>

        <v-row>
          <v-col cols="12" sm="6" md="4">
            <v-text-field v-model="yearLived" label="Year Lived"></v-text-field>
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-text-field v-model="occupation" label="Occupation"></v-text-field>
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-select
              v-model="isVoter"
              :items="['Yes', 'No']"
              label="Are you a voter?"
            ></v-select>
          </v-col>
        </v-row>

        <v-row>
          <v-col cols="12" sm="6" md="4">
            <v-text-field v-model="contactNo" label="Contact No"></v-text-field>
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-text-field v-model="emailAddress" label="Email Address"></v-text-field>
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-file-input
              v-model="proofOfResidency"
              label="Change Proof of Residency"
              accept="image/*,application/pdf"
              @change="handleFileUpload"
            ></v-file-input>
            <small v-if="proofOfResidencyName">Selected file: {{ proofOfResidencyName }}</small>
          </v-col>
        </v-row>
      </v-card-item>
    </v-card>
    <v-card prepend-icon="mdi-file-document" title="Proof of Residency Preview" class="mt-10">
      <v-card-item class="py-5">
        <v-row>
          <v-col cols="12" sm="6" md="4">
            <v-sheet aspect-ratio="1/1" class="pa-3" color="grey-lighten-3 rounded-lg">
              <v-img :src="proofOfResidencyPreview" aspect-ratio="16/9"></v-img>
            </v-sheet>
          </v-col>
        </v-row>
      </v-card-item>
    </v-card>
  </v-container>
</template>