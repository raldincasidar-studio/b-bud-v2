<template>
  <v-container class="my-10">
    <v-row justify="space-between mb-10">
      <v-col><h2>Add New Product</h2></v-col>
      <v-col class="text-right"
        ><v-btn
          rounded
          size="large"
          variant="tonal"
          @click="saveProduct"
          prepend-icon="mdi-package-variant"
          color="primary"
          >Save Product</v-btn
        ></v-col
      >
    </v-row>

    <v-card prepend-icon="mdi-package-variant" title="Product Information">
      <v-card-item>
        <v-row>
          <v-col cols="12" sm="12" md="6">
            <v-text-field v-model="serial_id" label="Serial ID"></v-text-field>
          </v-col>
          <v-col cols="12" sm="12" md="6">
            <v-text-field v-model="brand" label="Brand"></v-text-field>
          </v-col>
        </v-row>

        <v-row>
          <v-col cols="12" sm="12" md="6">
            <v-text-field v-model="model" label="Model"></v-text-field>
          </v-col>
          <v-col cols="12" sm="12" md="6">
            <v-text-field v-model="unit" label="Unit"></v-text-field>
          </v-col>
        </v-row>

        <v-row>
          <v-col cols="12" sm="12">
            <v-textarea
              v-model="comment"
              label="Comment / Note"
              rows="3"
              auto-grow
            ></v-textarea>
          </v-col>
        </v-row>

        <v-row>
          <v-col cols="12" sm="12" md="6">
            <v-text-field
              v-model="cod"
              label="COD (Price)"
              prefix="₱"
              type="number"
            ></v-text-field>
          </v-col>
        </v-row>
      </v-card-item>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref } from "vue";
import { useMyFetch } from "../composables/useMyFetch";
const { $toast } = useNuxtApp();

const serial_id = ref("");
const brand = ref("");
const model = ref("");
const unit = ref("");
const comment = ref("");
const cod = ref(0);

// const { post } = useMyFetch();
const router = useRouter();
const saveProduct = async () => {
  const data = {
    serial_id: serial_id.value,
    brand: brand.value,
    model: model.value,
    unit: unit.value,
    comment: comment.value,
    cod: cod.value,
  };

  try {
    const {postData, error} = await useMyFetch("/api/products", {
      method: 'post', 
      body: data
    });

    if (error.value) return;

    router.replace('/inventory')
  } catch (error) {
    console.error(error);
    $toast.fire({
      title: 'Something went wrong',
      icon: 'error'
    })
  }
  

};
</script>

