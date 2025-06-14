<template>
  <v-container class="my-10">
    <v-row justify="space-between" align="center" class="mb-6">
      <v-col>
        <h2 class="text-h4 font-weight-bold">Add New Barangay Official</h2>
        <p class="text-grey-darken-1">Enter the details for the new official.</p>
      </v-col>
      <v-col class="text-right">
        <v-btn
          :loading="saving"
          size="large"
          @click="saveOfficial"
          prepend-icon="mdi-content-save"
          color="primary"
        >
          Save Official
        </v-btn>
      </v-col>
    </v-row>

    <v-card class="mt-4" flat border>
      <v-card-text class="py-6">
        <v-row>
            <v-col cols="12" md="4">
              <label class="v-label mb-1">Last Name <span class="text-red">*</span></label>
              <v-text-field
                v-model="form.last_name"
                label="Enter last name"
                variant="outlined"
                :error-messages="v$.last_name.$errors.map(e => e.$message)"
                @blur="v$.last_name.$touch"
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="4">
              <label class="v-label mb-1">First Name <span class="text-red">*</span></label>
              <v-text-field
                v-model="form.first_name"
                label="Enter first name"
                variant="outlined"
                :error-messages="v$.first_name.$errors.map(e => e.$message)"
                @blur="v$.first_name.$touch"
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="4">
              <label class="v-label mb-1">Middle Name (Optional)</label>
              <v-text-field
                v-model="form.middle_name"
                label="Enter middle name"
                variant="outlined"
              ></v-text-field>
            </v-col>
        </v-row>

        <v-row>
          <v-col cols="12" md="4">
            <label class="v-label mb-1">Sex <span class="text-red">*</span></label>
            <v-select
              v-model="form.sex"
              label="Select sex"
              :items="['Male', 'Female']"
              variant="outlined"
              :error-messages="v$.sex.$errors.map(e => e.$message)"
              @blur="v$.sex.$touch"
            ></v-select>
          </v-col>
          <v-col cols="12" md="4">
            <label class="v-label mb-1">Civil Status <span class="text-red">*</span></label>
            <v-select
              v-model="form.civil_status"
              label="Select civil status"
              :items="['Single', 'Married', 'Widowed', 'Separated']"
              variant="outlined"
              :error-messages="v$.civil_status.$errors.map(e => e.$message)"
              @blur="v$.civil_status.$touch"
            ></v-select>
          </v-col>
          <v-col cols="12" md="4">
            <label class="v-label mb-1">Religion (Optional)</label>
            <v-text-field
              v-model="form.religion"
              label="Enter religion"
              variant="outlined"
            ></v-text-field>
          </v-col>
        </v-row>
        
        <v-divider class="my-4"></v-divider>

        <v-row>
          <v-col cols="12" md="6">
            <label class="v-label mb-1">Position / Designation <span class="text-red">*</span></label>
            <v-select
              v-model="form.position"
              label="Select a position"
              :items="['Punong Barangay', 'Barangay Secretary', 'Treasurer', 'Sangguniang Barangay Member', 'SK Chairperson', 'SK Member']"
              variant="outlined"
              :error-messages="v$.position.$errors.map(e => e.$message)"
              @blur="v$.position.$touch"
            ></v-select>
          </v-col>
          <v-col cols="12" md="6">
            <label class="v-label mb-1">Term in Present Position <span class="text-red">*</span></label>
            <v-select
              v-model="form.term_in_present_position"
              label="Select term"
              :items="['1st', '2nd', '3rd']"
              variant="outlined"
              :error-messages="v$.term_in_present_position.$errors.map(e => e.$message)"
              @blur="v$.term_in_present_position.$touch"
            ></v-select>
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" md="4">
            <label class="v-label mb-1">Term Start Date <span class="text-red">*</span></label>
            <v-text-field
              v-model="form.term_start"
              type="date"
              variant="outlined"
              :error-messages="v$.term_start.$errors.map(e => e.$message)"
              @blur="v$.term_start.$touch"
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="4">
            <label class="v-label mb-1">Term End Date (Optional)</label>
            <v-text-field
              v-model="form.term_end"
              label="Leave blank if currently serving"
              type="date"
              variant="outlined"
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="4">
            <label class="v-label mb-1">Status <span class="text-red">*</span></label>
            <v-select
              v-model="form.status"
              :items="['Active', 'Inactive']"
              variant="outlined"
              :error-messages="v$.status.$errors.map(e => e.$message)"
              @blur="v$.status.$touch"
            ></v-select>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useVuelidate } from '@vuelidate/core';
import { required, helpers } from '@vuelidate/validators';
import { useMyFetch } from '../../composables/useMyFetch';
import { useNuxtApp } from '#app';

const { $toast } = useNuxtApp();
const router = useRouter();

// State for the form, aligned with the new data model
const form = reactive({
  first_name: '',
  last_name: '',
  middle_name: '',
  sex: null,
  civil_status: null,
  religion: '',
  term_in_present_position: null,
  position: null,
  term_start: '',
  term_end: '',
  status: 'Active',
  photo_url: null,
});

const saving = ref(false);

// Vuelidate rules
const rules = {
  first_name: { required },
  last_name: { required },
  sex: { required },
  civil_status: { required },
  position: { required },
  term_in_present_position: { required },
  term_start: { required },
  status: { required },
};

const v$ = useVuelidate(rules, form);

async function saveOfficial() {
  const isFormCorrect = await v$.value.$validate();
  if (!isFormCorrect) {
    $toast.fire({ title: 'Please correct the form errors.', icon: 'error' });
    return;
  }

  saving.value = true;
  try {
    const { data, error } = await useMyFetch('/api/barangay-officials', {
      method: 'post', 
      body: form, // Send the entire reactive form object
    });

    if (error.value) {
      // The API now sends specific error messages (e.g., for duplicate unique roles)
      throw new Error(error.value.data?.error || 'Failed to add official.');
    }

    $toast.fire({ title: 'Official added successfully!', icon: 'success' });
    router.push('/barangay-officials'); // Navigate to the correct list page

  } catch (e) {
    $toast.fire({ title: e.message, icon: 'error' });
  } finally {
    saving.value = false;
  }
}
</script>