<template>
  <v-container class="my-10">
    <v-row justify="space-between" align="center" class="mb-4">
      <v-col>
        <h2 class="text-h4 font-weight-bold">Edit Budget</h2>
        <p class="text-grey-darken-1">Update or remove this budget entry.</p>
      </v-col>
      <v-col class="text-right">
        <!-- === BUTTONS SWAPPED === -->

        <!-- Save/Update Button (Now on the left) -->
        <v-btn
          @click="saveBudget"
          color="primary"
          size="large"
          prepend-icon="mdi-content-save-edit"
          :loading="loading"
          :disabled="loading"
          class="mr-4" 
        >
          Save/Update Budget
        </v-btn>

        <!-- Delete Button (Now on the right) -->
        <v-btn
          @click="deleteBudget"
          color="error"
          variant="outlined"
          size="large"
          prepend-icon="mdi-delete"
          :loading="loading"
          :disabled="loading"
        >
          Delete
        </v-btn>
        
      </v-col>
    </v-row>

    <!-- Loading Skeleton -->
    <v-card v-if="!dataLoaded" class="mt-6" flat border>
      <v-skeleton-loader type="card-avatar, article, actions"></v-skeleton-loader>
    </v-card>
    
    <!-- Main Form Card -->
    <v-card v-else class="mt-6" flat border>
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
            <v-combobox
              v-model="form.category"
              :items="categories"
              label="Select or type a category"
              variant="outlined"
              :error-messages="v$.category.$errors.map(e => e.$message)"
              @blur="v$.category.$touch"
            ></v-combobox>
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
import { reactive, ref, onMounted } from "vue";
import { useMyFetch } from "~/composables/useMyFetch";
import { useVuelidate } from '@vuelidate/core';
import { required, numeric } from '@vuelidate/validators';

const { $toast } = useNuxtApp();
const router = useRouter();
const route = useRoute();
const budgetId = route.params.id;

const loading = ref(false);
const dataLoaded = ref(false);

const form = reactive({
  budgetName: "",
  category: null,
  amount: null,
  date: "",
});

const categories = ref([]);

const rules = {
  budgetName: { required },
  category: { required },
  amount: { required, numeric },
  date: { required },
};

const v$ = useVuelidate(rules, form);

onMounted(async () => {
  if (!budgetId) {
    $toast.fire({ title: 'Invalid Budget ID.', icon: 'error' });
    router.push('/budget-management');
    return;
  }
  try {
    const { data: categoriesData, error: categoriesError } = await useMyFetch('/api/budgets/categories');
    if (categoriesError.value) throw new Error(categoriesError.value.data?.message || 'Error fetching categories');
    categories.value = categoriesData.value.categories;

    const { data, error } = await useMyFetch(`/api/budgets/${budgetId}`);
    if (error.value) throw new Error(error.value.data?.message || 'Error fetching data');
    
    const budget = data.value.budget;
    form.budgetName = budget.budgetName;
    form.category = budget.category;
    form.amount = budget.amount;
    form.date = new Date(budget.date).toISOString().split('T')[0];

    dataLoaded.value = true;
  } catch (err) {
    $toast.fire({ title: err.message, icon: 'error' });
    router.push('/budget-management');
  }
});

const saveBudget = async () => {
  const isFormCorrect = await v$.value.$validate();
  if (!isFormCorrect) {
    return $toast.fire({ title: 'Please correct the errors on the form.', icon: 'error' });
  }

  loading.value = true;
  try {
    const { error } = await useMyFetch(`/api/budgets/${budgetId}`, {
      method: 'put',
      body: form,
    });

    if (error.value) throw new Error(error.value.data?.message || 'Error updating budget');

    $toast.fire({ title: 'Budget updated successfully', icon: 'success' });
    router.push('/budget-management');

  } catch (err) {
    $toast.fire({ title: err.message, icon: 'error' });
  } finally {
    loading.value = false;
  }
};

const deleteBudget = () => {
  $toast.fire({
    title: 'Are you sure?',
    text: "This budget entry will be permanently deleted. You won't be able to revert this!",
    icon: 'warning',
    showCancelButton: true,
    showConfirmButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: 'Confirm'
  }).then(async (result) => {
    if (result.isConfirmed) {
      loading.value = true;
      try {
        const { error } = await useMyFetch(`/api/budgets/${budgetId}`, {
          method: 'delete',
        });

        if (error.value) throw new Error(error.value.data?.message || 'Error deleting budget');

        await $toast.fire(
          'Deleted!',
          'The budget entry has been deleted.',
          'success'
        );
        
        router.push('/budget-management');

      } catch (err) {
        $toast.fire({ title: err.message, icon: 'error' });
      } finally {
        loading.value = false;
      }
    }
  });
};
</script>