<script setup>
import { ref } from "vue";
import { useMyFetch } from "../composables/useMyFetch";
const { $toast } = useNuxtApp();
const router = useRouter();

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
    const { data, error } = await useMyFetch("/api/residents", {
      method: 'post',
      body: residentData,
    });

    if (error.value || data?.value?.error) return $toast.fire({
      title: data?.value?.error || 'Something went wrong while adding resident',
      icon: 'error',
    })

    $toast.fire({
      title: data?.value?.message || 'Resident added successfully',
      icon: 'success',
    });
    router.push('/residents'); // Assuming you have a residents list page
  } catch (error) {
    console.error(error);
    $toast.fire({
      title: 'Something went wrong while adding resident',
      icon: 'error',
    });
  }
};
</script>

<template>
  <v-container class="my-10">
    <v-row justify="space-between mb-10">
      <v-col><h2>Add New Resident</h2></v-col>
      <v-col class="text-right">
        <v-btn
          rounded
          size="large"
          variant="tonal"
          @click="saveResident"
          prepend-icon="mdi-account-plus"
          color="primary"
        >
          Add Resident
        </v-btn>
      </v-col>
    </v-row>

    <v-card prepend-icon="mdi-account-card-details" title="Personal Information">
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
              label="Upload Proof of Residency"
              accept="image/*,application/pdf"
              @change="handleFileUpload"
            ></v-file-input>
            <small v-if="proofOfResidencyName">Selected file: {{ proofOfResidencyName }}</small>
          </v-col>
        </v-row>
      </v-card-item>
    </v-card>
  </v-container>
</template>