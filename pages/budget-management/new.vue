<template>
  <v-container class="my-10">
    <v-row justify="space-between" align="center" class="mb-4">
      <v-col>
        <!-- Updated Title and Description -->
        <h2 class="text-h4 font-weight-bold">Add/Edit Budget</h2>
        <p class="text-grey-darken-1">Create a new budget entry.</p>
      </v-col>
      <v-col class="text-right">
        <!-- Updated Save Button -->
        <v-btn
          @click="saveBudget"
          color="primary"
          size="large"
          prepend-icon="mdi-content-save"
          :loading="loading"
          :disabled="loading"
        >
          Save/Update Budget
        </v-btn>
      </v-col>
    </v-row>

    <v-card class="mt-6" flat border>
      <v-card-text class="py-6">
        <v-row>
          <!-- Budget Name Field -->
          <v-col cols="12" md="6">
            <label class="v-label mb-3 font-weight-bold text-black">Budget Name <span class="text-red">*</span></label>
            <v-text-field
              v-model="form.budgetName"
              label="e.g., Traveling Expenses"
              variant="outlined"
              :error-messages="v$.budgetName.$errors.map(e => e.$message)"
              @blur="v$.budgetName.$touch"
            ></v-text-field>
          </v-col>

          <!-- Category Dropdown -->
          <v-col cols="12" md="6">
            <label class="v-label mb-3 font-weight-bold text-black">Category <span class="text-red">*</span></label>
            <v-select
              v-model="form.category"
              :items="categories"
              label="Select a category"
              variant="outlined"
              :error-messages="v$.category.$errors.map(e => e.$message)"
              @blur="v$.category.$touch"
            ></v-select>
          </v-col>

          <!-- Amount Field -->
          <v-col cols="12" md="6">
            <label class="v-label mb-3 font-weight-bold text-black">Amount <span class="text-red">*</span></label>
            <v-text-field
              v-model="form.amount"
              label="e.g., 18000"
              type="number"
              variant="outlined"
              :error-messages="v$.amount.$errors.map(e => e.$message)"
              @blur="v$.amount.$touch"
            ></v-text-field>
          </v-col>

          <!-- Date Field -->
          <v-col cols="12" md="6">
            <label class="v-label mb-3 font-weight-bold text-black">Date <span class="text-red">*</span></label>
            <v-text-field
              v-model="form.date"
              type="date"
              variant="outlined"
              :error-messages="v$.date.$errors.map(e => e.$message)"
              @blur="v$.date.$touch"
            ></v-text-field>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import { reactive, ref } from "vue";
import { useMyFetch } from "~/composables/useMyFetch";
import { useVuelidate } from '@vuelidate/core';
import { required, numeric } from '@vuelidate/validators';

const { $toast } = useNuxtApp();
const router = useRouter();
const loading = ref(false);

// Reactive form for budget data
const form = reactive({
  budgetName: "",
  category: null,
  amount: null,
  date: "",
});

// Categories for the dropdown, based on your design
const categories = ref([
  'Maintenance and Other Operating Expenses',
  'Statutory and Contractual Obligations',
  'General and Administrative Expenses',
  'Capital Outlay'
]);

// Validation rules for the form
const rules = {
  budgetName: { required },
  category: { required },
  amount: { required, numeric },
  date: { required },
};

const v$ = useVuelidate(rules, form);

// Function to save the budget
const saveBudget = async () => {
  const isFormCorrect = await v$.value.$validate();

  if (!isFormCorrect) {
    return $toast.fire({
      title: 'Please correct the errors on the form.',
      icon: 'error',
    });
  }

  loading.value = true;
  try {
    // API call to the budget endpoint
    const { data, error } = await useMyFetch("/api/budgets", {
      method: 'post',
      body: form,
    });

    if (error.value || data?.value?.error) {
      return $toast.fire({
        title: data?.value?.error || 'Something went wrong while adding the budget.',
        icon: 'error',
      });
    }

    $toast.fire({
      title: data?.value?.message || 'Budget added successfully!',
      icon: 'success',
    });

    // Redirect to the budget management index page
    router.push('/budget-management');

  } catch (err) {
    console.error(err);
    $toast.fire({
      title: 'An unexpected error occurred.',
      icon: 'error',
    });
  } finally {
    loading.value = false;
  }
};
</script>