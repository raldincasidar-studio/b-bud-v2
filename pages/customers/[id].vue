<template>
  <v-container class="my-10">
    <v-row justify="space-between mb-10">
      <v-col><h2>{{ applicantName }}</h2></v-col>
      <v-col class="text-right" v-if="pageViewing == 'info'">
        <v-btn
          rounded
          size="large"
          variant="tonal"
          prepend-icon="mdi-delete"
          color="red"
          @click="deleteCustomer()"
          >DELETE</v-btn
        >
        <v-btn
          rounded
          size="large"
          variant="tonal"
          prepend-icon="mdi-content-save"
          color="blue"
          @click="saveCustomer()"
          >Save Customer</v-btn
        >
      </v-col>
      <v-col class="text-right" v-if="pageViewing == 'ledger'">
        <h4>Balance</h4>
        <h3 class="text-h3">
          {{ new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(balance) }}
        </h3>
      </v-col>
    </v-row>

    <div class="chips-container my-5 mb-10">
      <v-chip
        size="x-large"
        class="ma-1"
        @click="pageViewing = 'info'"
        :color="pageViewing == 'info' ? 'primary' : 'grey-darken-2'"
        :variant="pageViewing == 'info' ? 'elevated' : 'tonal'"
      >
        <v-icon icon="mdi-account" class="mr-2"></v-icon> Customer
        Information</v-chip
      >
      <v-chip
        size="x-large"
        class="ma-1"
        @click="pageViewing = 'ledger'"
        :color="pageViewing == 'ledger' ? 'primary' : 'grey-darken-2'"
        :variant="pageViewing == 'ledger' ? 'elevated' : 'tonal'"
      >
        <v-icon icon="mdi-cash" class="mr-2"></v-icon> Ledger</v-chip
      >
    </div>

    <transition-group name="fade" mode="out-in">









      <div v-if="pageViewing == 'info'" :key="'info'">
        <!-- content here -->
        <v-card class="pa-3" rounded="lg">
          <v-card-text>
            <!-- <v-autocomplete
            prepend-inner-icon="mdi-magnify"
            variant="outlined"
            color="primary"
            v-model:search="searchProductQuery"
            @update:search="searchProducts"
            @update:modelValue="searchForItem"
            label="Search for Products"
            placeholder="Search for product name, serial id, model etc.."
            item-title="name"
            item-value="id"
            v-model="itemId"
            :items="productSearchResult"
            rounded="lg"
          ></v-autocomplete> -->
  
            <h3 class="font-weight-regular text-primary mt-4">
              <v-icon icon="mdi-package-variant" class="mr-2" size="30"></v-icon
              >Selected Product
            </h3>
            <v-card variant="outlined" color="primary" class="pa-4 my-4">
              <v-card-text v-if="itemInformation?.id">
                <v-row flex-wrap>
                  <v-col cols="12" md="3">
                    <p>Brand</p>
                    <h2 class="text-black">{{ itemInformation?.brand }}</h2>
                  </v-col>
                  <v-col cols="12" md="3">
                    <p>Item</p>
                    <h2 class="text-black">{{ itemInformation?.model }}</h2>
                  </v-col>
                  <v-col cols="12" md="3">
                    <p>Unit</p>
                    <h2 class="text-black">{{ itemInformation?.unit }}</h2>
                  </v-col>
                  <v-col cols="12" md="3">
                    <p>Serial No.</p>
                    <h2 class="text-black">{{ itemInformation?.serial_id }}</h2>
                  </v-col>
                  <v-col cols="12" class="text-center">
                    <p>COD</p>
                    <h2 class="text-black text-primary">
                      {{
                        new Intl.NumberFormat("en-PH", {
                          style: "currency",
                          currency: "PHP",
                        }).format(itemInformation?.cod)
                      }}
                    </h2>
                  </v-col>
                </v-row>
              </v-card-text>
              <v-card-text v-else class="text-center py-5">
                <v-icon
                  icon="mdi-package-variant"
                  color="grey"
                  size="60"
                ></v-icon>
                <h3 class="mt-5 text-grey">Search for products</h3>
              </v-card-text>
            </v-card>
  
            <div
              class="d-flex justify-space-between align-center mt-12"
              v-if="itemInformation?.id"
            >
              <h3 class="font-weight-regular text-primary">
                <v-icon icon="mdi-cash-multiple" class="mr-2" size="30"></v-icon
                >Select Monthly Payments
              </h3>
              <div>
                <v-text-field
                  readonly
                  v-model="down_payment"
                  label="Set DP"
                  max-width="250"
                  prepend-inner-icon="mdi-currency-php"
                  hide-details
                ></v-text-field>
                <v-btn @click="calculateMonthly" variant="tonal" color="primary"
                  >Recalculate</v-btn
                >
              </div>
            </div>
  
            <div
              v-if="itemInformation?.id"
              class="scrollable py-5 d-flex flex-nowrap flex-0-0 overflow-x-auto ga-5"
            >
              <v-card
                style="flex: 0 0 250px"
                class="pa-3 py-6 text-center"
                @click="selectedTerms = 3"
                variant="outlined"
                v-ripple
                :elevation="selectedTerms == 3 ? 5 : 0"
                :color="selectedTerms == 3 ? 'primary' : 'grey'"
              >
                <h3 class="text-primary">3 months</h3>
                <p class="text-grey mt-5 mb-2">Down Payment</p>
                <h2 class="text-black">
                  {{
                    new Intl.NumberFormat("en-PH", {
                      style: "currency",
                      currency: "PHP",
                    }).format(down_payment)
                  }}
                </h2>
                <p class="text-grey mt-5 mb-2">Down Payment</p>
                <v-text-field
                  :disabled="selectedTerms == 3 ? false : true"
                  prepend-inner-icon="mdi-currency-php"
                  class="font-weight-bold text-black"
                  v-model="three_months_calc"
                  type="number"
                ></v-text-field>
              </v-card>
              <v-card
                style="flex: 0 0 250px"
                class="pa-3 py-6 text-center"
                @click="selectedTerms = 6"
                variant="outlined"
                v-ripple
                :elevation="selectedTerms == 6 ? 5 : 0"
                :color="selectedTerms == 6 ? 'primary' : 'grey'"
              >
                <h3 class="text-primary">6 months</h3>
                <p class="text-grey mt-5 mb-2">Down Payment</p>
                <h2 class="text-black">
                  {{
                    new Intl.NumberFormat("en-PH", {
                      style: "currency",
                      currency: "PHP",
                    }).format(down_payment)
                  }}
                </h2>
                <p class="text-grey mt-5 mb-2">Down Payment</p>
                <v-text-field
                  :disabled="selectedTerms == 6 ? false : true"
                  prepend-inner-icon="mdi-currency-php"
                  class="font-weight-bold text-black"
                  v-model="six_months_calc"
                  type="number"
                ></v-text-field>
              </v-card>
              <v-card
                style="flex: 0 0 250px"
                class="pa-3 py-6 text-center"
                @click="selectedTerms = 12"
                variant="outlined"
                v-ripple
                :elevation="selectedTerms == 12 ? 5 : 0"
                :color="selectedTerms == 12 ? 'primary' : 'grey'"
              >
                <h3 class="text-primary">12 months</h3>
                <p class="text-grey mt-5 mb-2">Down Payment</p>
                <h2 class="text-black">
                  {{
                    new Intl.NumberFormat("en-PH", {
                      style: "currency",
                      currency: "PHP",
                    }).format(down_payment)
                  }}
                </h2>
                <p class="text-grey mt-5 mb-2">Down Payment</p>
                <v-text-field
                  :disabled="selectedTerms == 12 ? false : true"
                  prepend-inner-icon="mdi-currency-php"
                  class="font-weight-bold text-black"
                  v-model="twelve_months_calc"
                  type="number"
                ></v-text-field>
              </v-card>
              <v-card
                style="flex: 0 0 250px"
                class="pa-3 py-6 text-center"
                @click="selectedTerms = 18"
                variant="outlined"
                v-ripple
                :elevation="selectedTerms == 18 ? 5 : 0"
                :color="selectedTerms == 18 ? 'primary' : 'grey'"
              >
                <h3 class="text-primary">18 months</h3>
                <p class="text-grey mt-5 mb-2">Down Payment</p>
                <h2 class="text-black">
                  {{
                    new Intl.NumberFormat("en-PH", {
                      style: "currency",
                      currency: "PHP",
                    }).format(down_payment)
                  }}
                </h2>
                <p class="text-grey mt-5 mb-2">Down Payment</p>
                <v-text-field
                  :disabled="selectedTerms == 18 ? false : true"
                  prepend-inner-icon="mdi-currency-php"
                  class="font-weight-bold text-black"
                  v-model="eighteen_months_calc"
                  type="number"
                ></v-text-field>
              </v-card>
              <v-card
                style="flex: 0 0 250px"
                class="pa-3 py-6 text-center"
                @click="selectedTerms = 24"
                variant="outlined"
                v-ripple
                :elevation="selectedTerms == 24 ? 5 : 0"
                :color="selectedTerms == 24 ? 'primary' : 'grey'"
              >
                <h3 class="text-primary">24 months</h3>
                <p class="text-grey mt-5 mb-2">Down Payment</p>
                <h2 class="text-black">
                  {{
                    new Intl.NumberFormat("en-PH", {
                      style: "currency",
                      currency: "PHP",
                    }).format(down_payment)
                  }}
                </h2>
                <p class="text-grey mt-5 mb-2">Down Payment</p>
                <v-text-field
                  :disabled="selectedTerms == 24 ? false : true"
                  prepend-inner-icon="mdi-currency-php"
                  class="font-weight-bold text-black"
                  v-model="twenty_four_months_calc"
                  type="number"
                ></v-text-field>
              </v-card>
            </div>
  
            <h3
              class="font-weight-regular text-primary mt-12 mb-5"
              v-if="itemInformation?.id"
            >
              <v-icon icon="mdi-calendar" class="mr-2" size="30"></v-icon>Payment
              Terms
            </h3>
  
            <v-row v-if="itemInformation?.id">
              <v-col cols="12" sm="6" md="6">
                <v-date-input
                  label="Starting Date"
                  v-model="starting_date"
                ></v-date-input>
              </v-col>
              <v-col cols="12" sm="6" md="6">
                <v-text-field
                  v-model="rebates"
                  label="Rebate"
                  prepend-icon="mdi-currency-php"
                ></v-text-field>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
  
        <!-- Personal Data -->
        <div class="header text-center py-13">
          <v-divider class="mb-n7" style="z-index: -1"></v-divider>
          <h3 class="d-inline-block pa-3 bg-white z-index-1">
            Customer's Personal Data
          </h3>
        </div>
  
        <v-card prepend-icon="mdi-package-variant" title="Personal Data">
          <v-card-item>
            <v-row>
              <v-col cols="12" sm="12" md="9">
                <v-text-field
                  v-model="applicantName"
                  label="Applicant's Name"
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="12" md="3">
                <v-select
                  v-model="civilStatus"
                  label="Civil Status"
                  :items="['Single', 'Married', 'Separated', 'Widowed']"
                ></v-select>
              </v-col>
              <v-col cols="12" sm="12">
                <v-text-field
                  v-model="spouseName"
                  label="Spouse's Name"
                ></v-text-field>
              </v-col>
            </v-row>
  
            <v-row>
              <v-col cols="12" sm="6" md="3">
                <v-text-field
                  v-model="applicantAge"
                  label="Applicant's Age"
                  type="number"
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="6" md="3">
                <v-text-field
                  v-model="spouseAge"
                  label="Spouse's Age"
                  type="number"
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="12" md="6">
                <v-text-field
                  v-model="numberOfDependents"
                  label="No. of Dependents"
                  type="number"
                ></v-text-field>
              </v-col>
            </v-row>
  
            <v-row>
              <v-col cols="12" sm="12" md="6">
                <v-text-field
                  v-model="contactNumber"
                  label="Contact Number"
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="12" md="6">
                <v-text-field v-model="agent" label="Agent"></v-text-field>
              </v-col>
            </v-row>
  
            <v-row>
              <v-col cols="12" sm="12" md="6">
                <v-text-field v-model="address" label="Address"></v-text-field>
              </v-col>
              <v-col cols="12" sm="12" md="6">
                <v-text-field v-model="city" label="City"></v-text-field>
              </v-col>
            </v-row>
  
            <v-row>
              <v-col cols="12" sm="12" md="6">
                <v-text-field
                  v-model="deliverTo"
                  label="Deliver To"
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="12" md="6">
                <v-select
                  v-model="residenceType"
                  label="Residence Type"
                  :items="['Own House', 'Rent House', 'Living w/ parents']"
                ></v-select>
              </v-col>
            </v-row>
  
            <v-row>
              <v-col cols="12" sm="12" md="6">
                <v-text-field
                  v-model="lengthOfStay"
                  label="Length of Stay"
                  placeholder="eg. 5 years"
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="12" md="6">
                <!-- <v-text-field v-model="collector" label="Collector"></v-text-field> -->
                <v-autocomplete
                  v-model="collector"
                  label="Collector"
                  :items="collectors"
                  item-title="name"
                  item-value="id"
                  @update:search="getCollectors"
                ></v-autocomplete>
              </v-col>
            </v-row>
  
            <!-- Dependents -->
            <v-row>
              <v-col cols="12">
                <h4>Dependents</h4>
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="12" sm="10" md="8">
                <v-text-field
                  v-model="dependent1Name"
                  label="Name of Dependent 1"
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="2" md="4">
                <v-text-field
                  v-model="dependent1Age"
                  label="Age"
                  type="number"
                ></v-text-field>
              </v-col>
            </v-row>
  
            <v-row>
              <v-col cols="12" sm="10" md="8">
                <v-text-field
                  v-model="dependent2Name"
                  label="Name of Dependent 2"
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="2" md="4">
                <v-text-field
                  v-model="dependent2Age"
                  label="Age"
                  type="number"
                ></v-text-field>
              </v-col>
            </v-row>
  
            <v-row>
              <v-col cols="12" sm="10" md="8">
                <v-text-field
                  v-model="dependent3Name"
                  label="Name of Dependent 3"
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="2" md="4">
                <v-text-field
                  v-model="dependent3Age"
                  label="Age"
                  type="number"
                ></v-text-field>
              </v-col>
            </v-row>
          </v-card-item>
        </v-card>
  
        <!-- References Relative -->
        <div class="header text-center py-13">
          <v-divider class="mb-n7" style="z-index: -1"></v-divider>
          <h3 class="d-inline-block pa-3 bg-white z-index-1">
            References (Relative)
          </h3>
        </div>
  
        <v-card
          prepend-icon="mdi-account-multiple"
          title="References (Relatives)"
        >
          <v-card-item>
            <!-- Reference 1 -->
            <v-row>
              <v-col cols="12">
                <h4>Reference 1</h4>
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="12" sm="12" md="6">
                <v-text-field
                  v-model="relativeReference1Name"
                  label="Name"
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="12" md="6">
                <v-text-field
                  v-model="relativeReference1Address"
                  label="Address"
                ></v-text-field>
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="12" sm="12" md="6">
                <v-text-field
                  v-model="relativeReference1Relationship"
                  label="Relationship"
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="12" md="6">
                <v-text-field
                  v-model="relativeReference1Telephone"
                  label="Telephone"
                ></v-text-field>
              </v-col>
            </v-row>
  
            <!-- Reference 2 -->
            <v-row>
              <v-col cols="12">
                <h4>Reference 2</h4>
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="12" sm="12" md="6">
                <v-text-field
                  v-model="relativeReference2Name"
                  label="Name"
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="12" md="6">
                <v-text-field
                  v-model="relativeReference2Address"
                  label="Address"
                ></v-text-field>
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="12" sm="12" md="6">
                <v-text-field
                  v-model="relativeReference2Relationship"
                  label="Relationship"
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="12" md="6">
                <v-text-field
                  v-model="relativeReference2Telephone"
                  label="Telephone"
                ></v-text-field>
              </v-col>
            </v-row>
          </v-card-item>
        </v-card>
        <!-- References Character -->
        <div class="header text-center py-13">
          <v-divider class="mb-n7" style="z-index: -1"></v-divider>
          <h3 class="d-inline-block pa-3 bg-white z-index-1">
            References (Character)
          </h3>
        </div>
  
        <v-card
          prepend-icon="mdi-account-multiple"
          title="References (Character)"
        >
          <v-card-item>
            <!-- Reference 1 -->
            <v-row>
              <v-col cols="12">
                <h4>Reference 1</h4>
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="12" sm="12" md="6">
                <v-text-field
                  v-model="characterReference1Name"
                  label="Name"
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="12" md="6">
                <v-text-field
                  v-model="characterReference1Address"
                  label="Address"
                ></v-text-field>
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="12" sm="12" md="6">
                <v-text-field
                  v-model="characterReference1Relationship"
                  label="Relationship"
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="12" md="6">
                <v-text-field
                  v-model="characterReference1Telephone"
                  label="Telephone"
                ></v-text-field>
              </v-col>
            </v-row>
  
            <!-- Reference 2 -->
            <v-row>
              <v-col cols="12">
                <h4>Reference 2</h4>
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="12" sm="12" md="6">
                <v-text-field
                  v-model="characterReference2Name"
                  label="Name"
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="12" md="6">
                <v-text-field
                  v-model="characterReference2Address"
                  label="Address"
                ></v-text-field>
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="12" sm="12" md="6">
                <v-text-field
                  v-model="characterReference2Relationship"
                  label="Relationship"
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="12" md="6">
                <v-text-field
                  v-model="characterReference2Telephone"
                  label="Telephone"
                ></v-text-field>
              </v-col>
            </v-row>
          </v-card-item>
        </v-card>
  
        <!-- Economic Information -->
        <div class="header text-center py-13">
          <v-divider class="mb-n7" style="z-index: -1"></v-divider>
          <h3 class="d-inline-block pa-3 bg-white z-index-1">
            Economic Information
          </h3>
        </div>
  
        <v-card prepend-icon="mdi-cash-multiple" title="Economic Information">
          <v-card-item>
            <!-- Current Employment -->
            <v-row>
              <v-col cols="12">
                <h4>Current Employment</h4>
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="12" sm="12" md="6">
                <v-text-field
                  v-model="currentEmployer"
                  label="Employer"
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="12" md="6">
                <v-text-field
                  v-model="currentEmployerAddress"
                  label="Employer's Address"
                ></v-text-field>
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="12" sm="6" md="4">
                <v-text-field
                  v-model="currentPosition"
                  label="Position"
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="6" md="4">
                <v-text-field
                  v-model="currentYearsThere"
                  label="Years There"
                  type="number"
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="12" md="4">
                <v-text-field
                  v-model="currentPesosPerMonth"
                  label="Pesos per Month"
                  prefix="₱"
                  type="number"
                ></v-text-field>
              </v-col>
            </v-row>
  
            <!-- Previous Employment -->
            <v-row>
              <v-col cols="12">
                <h4>Previous Employment</h4>
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="12" sm="12" md="6">
                <v-text-field
                  v-model="previousEmployer"
                  label="Previous Employer"
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="6" md="3">
                <v-text-field
                  v-model="previousYearsThere"
                  label="Years There"
                  type="number"
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="6" md="3">
                <v-text-field
                  v-model="previousPesosPerMonth"
                  label="Pesos per Month"
                  prefix="₱"
                  type="number"
                ></v-text-field>
              </v-col>
            </v-row>
          </v-card-item>
        </v-card>
      </div>











      <div v-if="pageViewing == 'ledger'" :key="'ledger'">
        <v-card class="pa-3" rounded="lg">
          <v-card-text>
            <h3 class="font-weight-regular text-primary mt-4 mb-10">
              <v-icon icon="mdi-package-variant" class="mr-2" size="30"></v-icon
              >Make new payment
            </h3>

            <v-row>
              <v-col cols="12" sm='12' md="6" lg="3">
                <v-select
                  v-model="new_payment_data.payment_type"
                  label="Payment Type"
                  :items="['Monthly Payment', 'Down Payment']"
                ></v-select>
              </v-col>
              <v-col cols="12" sm='12' md="6" lg="3">
                <v-text-field
                  v-model="new_payment_data.or_number"
                  label="OR Number"
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm='12' md="6" lg="3">
                <v-text-field
                  v-model="new_payment_data.amount"
                  label="Amount"
                  prefix="₱"
                  type="number"
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm='12' md="6" lg="3">
                <v-date-input
                  v-model="new_payment_data.pay_for_the_month_of"
                  label="Pay for the month of"
                ></v-date-input>
              </v-col>
              <v-col cols="12" sm='12' md="6" lg="3">
                <v-date-input
                  v-model="new_payment_data.payment_date"
                  label="Payment Date"
                ></v-date-input>
              </v-col>
              <v-col cols="12">
                <v-btn block color="primary" @click="savePayment" size="large" class="mt-0">Save Payment</v-btn>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <v-card class="pa-3 mt-10" rounded="lg">
          <h3 class="font-weight-regular text-primary mt-4 mb-10">
            <v-icon icon="mdi-package-variant" class="mr-2" size="30"></v-icon
            >Payments History
          </h3>

          <v-text-field label="Search Payment" placeholder="Search for Date, Amount, etc ..." hide-details prepend-inner-icon="mdi-magnify" variant="outlined" v-model="search_payment"></v-text-field>
          <v-data-table :items="payments" :search="search_payment">
            <template v-slot:item.payment_date="{ item }">
              {{ new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: '2-digit' }).format(new Date(item.payment_date)) }}
            </template>
            <template v-slot:item.pay_for_the_month_of="{ item }">
              {{ new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long' }).format(new Date(item.payment_date)) }}
            </template>
            <template v-slot:item.amount="{ item }">
              {{ item.amount.toLocaleString('en-US', { style: 'currency', currency: 'PHP' }) }}
            </template>
            <template v-slot:item.action="{ item }">
              <v-btn variant="fab" color="grey" @click="deletePayment(item.id)"><v-icon icon="mdi-delete"></v-icon></v-btn>
            </template>
          </v-data-table>
        </v-card>
      </div>
    </transition-group>
  </v-container>
</template>

<style>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter, .fade-leave-to /* .fade-leave-active in <2.1.8 */ {
  opacity: 0;
}
</style>

<script setup>
import { VDateInput } from "vuetify/labs/VDateInput";
const { $toast, $swal } = useNuxtApp();
// Date selection
const menu = ref(false);
const date = ref(null);

const pageViewing = ref("info");


const new_payment_data = ref({
  payment_type: 'Monthly Payment',
  or_number: '',
  amount: 0,
  pay_for_the_month_of: null,
  payment_date: null
})

async function deletePayment(payment_id) {

  const { isConfirmed } = await $swal.fire({
    title: 'Are you sure?',
    text: "You won't be able to revert this!",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    confirmButtonText: 'Yes, delete it!'
  })

  if (!isConfirmed) return

  const deleteFetch = await useMyFetch('/api/customers/' + useRoute().params.id + '/payments/' + payment_id, {
    method: 'delete'
  })

  if (deleteFetch.error.value) return

  $toast.fire({
    title: 'Deleted!',
    icon: 'success'
  })

  getPayments();

}

const productSearchResult = ref([
  // {
  //   name: 'Samsung Galaxy S21 Ultra Black 128GB [SN: 1234567890]',
  //   id: 155,
  // },
  // {
  //   name: 'Google Pixel 6 Pro White 256GB [SN: 0987654321]',
  //   id: 156,
  // },
  // {
  //   name: 'OnePlus 9 Pro Green 256GB [SN: 1122334455]',
  //   id: 157,
  // },
  // {
  //   name: 'Xiaomi Mi 11 Ultra Silver 512GB [SN: 6677889900]',
  //   id: 158,
  // },
  // {
  //   name: 'Sony Xperia 5 III Blue 128GB [SN: 3344556677]',
  //   id: 159,
  // }
]);

const collectors = ref([]);
const collectorsSearch = ref();

async function getCollectors() {
  const { data, error } = await useMyFetch("/api/employees", {
    method: "get",
    query: {
      search: collectorsSearch.value,
    },
  });
  if (error.value) return;
  collectors.value = data.value.data;
}

const itemInformation = ref({});

async function searchForItem(data) {
  const { data: res, error } = await useMyFetch("/api/products/" + data);

  if (error.value) return;
  if (!res.value.product) return;
  itemInformation.value = res.value?.product;

  down_payment.value = Number(res.value?.product?.cod) * 0.2;
  total_price.value = Number(res.value?.product.cod);
  itemId.value = data;
  calculateMonthly();

  console.log(itemInformation.value);
}

const searchProductQuery = ref("");
async function searchProducts(searchData) {
  // console.log(searchData, searchProductQuery.value)
  const { data, error } = await useMyFetch("/api/search/products", {
    method: "get",
    query: {
      search: searchProductQuery.value,
    },
  });

  if (error.value) return;

  productSearchResult.value = data.value.data;
}

const router = useRouter();
async function saveCustomer() {
  console.log(itemId);
  // logAllVModels();
  const customerData = {
    starting_date: starting_date.value,
    rebates: rebates.value,
    itemId: itemId.value,
    down_payment: parseFloat(down_payment.value) || 0,
    selectedTerms: parseInt(selectedTerms.value) || 3,
    threeMonthsCalc: parseFloat(three_months_calc.value) || 0,
    sixMonthsCalc: parseFloat(six_months_calc.value) || 0,
    twelveMonthsCalc: parseFloat(twelve_months_calc.value) || 0,
    eighteenMonthsCalc: parseFloat(eighteen_months_calc.value) || 0,
    twentyFourMonthsCalc: parseFloat(twenty_four_months_calc.value) || 0,
    applicantName: applicantName.value,
    civilStatus: civilStatus.value,
    spouseName: spouseName.value,
    applicantAge: parseInt(applicantAge.value) || null,
    spouseAge: parseInt(spouseAge.value) || null,
    numberOfDependents: parseInt(numberOfDependents.value) || null,
    contactNumber: contactNumber.value,
    agent: agent.value,
    address: address.value,
    city: city.value,
    deliverTo: deliverTo.value,
    residenceType: residenceType.value,
    lengthOfStay: lengthOfStay.value,
    collector: collector.value,
    dependent1Name: dependent1Name.value,
    dependent1Age: parseInt(dependent1Age.value) || null,
    dependent2Name: dependent2Name.value,
    dependent2Age: parseInt(dependent2Age.value) || null,
    dependent3Name: dependent3Name.value,
    dependent3Age: parseInt(dependent3Age.value) || null,
    relativeReference1Name: relativeReference1Name.value,
    relativeReference1Address: relativeReference1Address.value,
    relativeReference1Relationship: relativeReference1Relationship.value,
    relativeReference1Telephone: relativeReference1Telephone.value,
    relativeReference2Name: relativeReference2Name.value,
    relativeReference2Address: relativeReference2Address.value,
    relativeReference2Relationship: relativeReference2Relationship.value,
    relativeReference2Telephone: relativeReference2Telephone.value,
    characterReference1Name: characterReference1Name.value,
    characterReference1Address: characterReference1Address.value,
    characterReference1Relationship: characterReference1Relationship.value,
    characterReference1Telephone: characterReference1Telephone.value,
    characterReference2Name: characterReference2Name.value,
    characterReference2Address: characterReference2Address.value,
    characterReference2Relationship: characterReference2Relationship.value,
    characterReference2Telephone: characterReference2Telephone.value,
    currentEmployer: currentEmployer.value,
    currentEmployerAddress: currentEmployerAddress.value,
    currentPosition: currentPosition.value,
    currentYearsThere: parseInt(currentYearsThere.value) || null,
    currentPesosPerMonth: parseFloat(currentPesosPerMonth.value) || null,
    previousEmployer: previousEmployer.value,
    previousYearsThere: parseInt(previousYearsThere.value) || null,
    previousPesosPerMonth: parseFloat(previousPesosPerMonth.value) || null,
  };

  console.log("Data to send to backend:", customerData);

  const { data, error, status } = await useMyFetch(
    "/api/customers/" + useRoute().params.id,
    {
      method: "put",
      body: customerData,
    }
  );

  console.log(data);

  if (error.value) {
    return;
  }

  router.push("/customers");
  $toast.fire({
    title: "Edit Saved!",
    icon: "success",
  });
}

async function calculateMonthly() {
  three_months_calc.value = parseFloat(
    (((total_price.value - down_payment.value) / 0.81 + 210) / 3).toFixed(2)
  );
  six_months_calc.value = parseFloat(
    (((total_price.value - down_payment.value) / 0.72 + 340) / 6).toFixed(2)
  );
  twelve_months_calc.value = parseFloat(
    (((total_price.value - down_payment.value) / 0.61 + 470) / 12).toFixed(2)
  );
  eighteen_months_calc.value = parseFloat(
    (((total_price.value - down_payment.value) / 0.51 + 850) / 18).toFixed(2)
  );
  twenty_four_months_calc.value = parseFloat(
    (((total_price.value - down_payment.value) / 0.42 + 650) / 24).toFixed(2)
  );
}
const total_price = ref(0);

const itemId = ref(null);
const down_payment = ref(0);
const selectedTerms = ref(3);

const starting_date = ref(null);
const rebates = ref(0);

const three_months_calc = ref(0);
const six_months_calc = ref(0);
const twelve_months_calc = ref(0);
const eighteen_months_calc = ref(0);
const twenty_four_months_calc = ref(0);

const applicantName = ref(null);
const civilStatus = ref(null);
const spouseName = ref(null);
const applicantAge = ref(null);
const spouseAge = ref(null);
const numberOfDependents = ref(null);
const contactNumber = ref(null);
const agent = ref(null);
const address = ref(null);
const city = ref(null);
const deliverTo = ref(null);
const residenceType = ref(null);
const lengthOfStay = ref(null);
const collector = ref(null);
const dependent1Name = ref(null);
const dependent1Age = ref(null);
const dependent2Name = ref(null);
const dependent2Age = ref(null);
const dependent3Name = ref(null);
const dependent3Age = ref(null);
const relativeReference1Name = ref(null);
const relativeReference1Address = ref(null);
const relativeReference1Relationship = ref(null);
const relativeReference1Telephone = ref(null);
const relativeReference2Name = ref(null);
const relativeReference2Address = ref(null);
const relativeReference2Relationship = ref(null);
const relativeReference2Telephone = ref(null);
const characterReference1Name = ref(null);
const characterReference1Address = ref(null);
const characterReference1Relationship = ref(null);
const characterReference1Telephone = ref(null);
const characterReference2Name = ref(null);
const characterReference2Address = ref(null);
const characterReference2Relationship = ref(null);
const characterReference2Telephone = ref(null);
const currentEmployer = ref(null);
const currentEmployerAddress = ref(null);
const currentPosition = ref(null);
const currentYearsThere = ref(null);
const currentPesosPerMonth = ref(null);
const previousEmployer = ref(null);
const previousYearsThere = ref(null);
const previousPesosPerMonth = ref(null);

async function deleteCustomer() {
  const { isConfirmed } = await new $swal({
    title: `Delete ${applicantName.value}?`,
    text: "This can not be reversed!",
    showCancelButton: true,
    confirmButtonText: "Yes, delete it!",
    cancelButtonText: "Cancel",
  });

  if (!isConfirmed) return;

  const { data, error } = await useMyFetch(
    `/api/customers/${useRoute().params.id}`,
    {
      method: "delete",
    }
  );

  if (error.value) {
    return;
  }

  router.push("/customers");
  $toast.fire({
    title: "Customer deleted!",
    icon: "success",
  });
}

const customer = ref({});
onMounted(async () => {
  const { data, error } = await useMyFetch(
    `/api/customers/${useRoute().params.id}`
  );

  if (error.value) return;

  total_price.value = data.value?.product?.cod || "";
  itemId.value = data.value?.product?.id || "";
  down_payment.value = data.value?.customer?.down_payment || "";
  selectedTerms.value = data.value?.customer?.selected_terms || "";

  starting_date.value = data.value?.customer?.starting_date || "";
  rebates.value = data.value?.customer?.rebates || "";

  three_months_calc.value = data.value?.customer?.three_months_calc || "";
  six_months_calc.value = data.value?.customer?.six_months_calc || "";
  twelve_months_calc.value = data.value?.customer?.twelve_months_calc || "";
  eighteen_months_calc.value = data.value?.customer?.eighteen_months_calc || "";
  twenty_four_months_calc.value =
    data.value?.customer?.twenty_four_months_calc || "";

  applicantName.value = data.value?.customer?.applicant_name || "";
  civilStatus.value = data.value?.customer?.civil_status || "";
  spouseName.value = data.value?.customer?.spouse_name || "";
  applicantAge.value = data.value?.customer?.applicant_age || "";
  spouseAge.value = data.value?.customer?.spouse_age || "";
  numberOfDependents.value = data.value?.customer?.number_of_dependents || "";
  contactNumber.value = data.value?.customer?.contact_number || "";
  agent.value = data.value?.customer?.agent || "";
  address.value = data.value?.customer?.address || "";
  city.value = data.value?.customer?.city || "";
  deliverTo.value = data.value?.customer?.deliver_to || "";
  residenceType.value = data.value?.customer?.residence_type || "";
  lengthOfStay.value = data.value?.customer?.length_of_stay || "";
  collector.value = data.value?.customer?.collector || "";
  dependent1Name.value = data.value?.customer?.dependent1_name || "";
  dependent1Age.value = data.value?.customer?.dependent1_age || "";
  dependent2Name.value = data.value?.customer?.dependent2_name || "";
  dependent2Age.value = data.value?.customer?.dependent2_age || "";
  dependent3Name.value = data.value?.customer?.dependent3_name || "";
  dependent3Age.value = data.value?.customer?.dependent3_age || "";
  relativeReference1Name.value =
    data.value?.customer?.relative_reference1_name || "";
  relativeReference1Address.value =
    data.value?.customer?.relative_reference1_address || "";
  relativeReference1Relationship.value =
    data.value?.customer?.relative_reference1_relationship || "";
  relativeReference1Telephone.value =
    data.value?.customer?.relative_reference1_telephone || "";
  relativeReference2Name.value =
    data.value?.customer?.relative_reference2_name || "";
  relativeReference2Address.value =
    data.value?.customer?.relative_reference2_address || "";
  relativeReference2Relationship.value =
    data.value?.customer?.relative_reference2_relationship || "";
  relativeReference2Telephone.value =
    data.value?.customer?.relative_reference2_telephone || "";
  characterReference1Name.value =
    data.value?.customer?.character_reference1_name || "";
  characterReference1Address.value =
    data.value?.customer?.character_reference1_address || "";
  characterReference1Relationship.value =
    data.value?.customer?.character_reference1_relationship || "";
  characterReference1Telephone.value =
    data.value?.customer?.character_reference1_telephone || "";
  characterReference2Name.value =
    data.value?.customer?.character_reference2_name || "";
  characterReference2Address.value =
    data.value?.customer?.character_reference2_address || "";
  characterReference2Relationship.value =
    data.value?.customer?.character_reference2_relationship || "";
  characterReference2Telephone.value =
    data.value?.customer?.character_reference2_telephone || "";
  currentEmployer.value = data.value?.customer?.current_employer || "";
  currentEmployerAddress.value =
    data.value?.customer?.current_employer_address || "";
  currentPosition.value = data.value?.customer?.current_position || "";
  currentYearsThere.value = data.value?.customer?.current_years_there || "";
  currentPesosPerMonth.value =
    data.value?.customer?.current_pesos_per_month || "";
  previousEmployer.value = data.value?.customer?.previous_employer || "";
  previousYearsThere.value = data.value?.customer?.previous_years_there || "";
  previousPesosPerMonth.value =
    data.value?.customer?.previous_pesos_per_month || "";

  itemInformation.value = data.value?.product;


  if (selectedTerms.value == "3") new_payment_data.value.amount = three_months_calc.value;
  if (selectedTerms.value == "6") new_payment_data.value.amount = six_months_calc.value;
  if (selectedTerms.value == "12") new_payment_data.value.amount = twelve_months_calc.value;
  if (selectedTerms.value == "18") new_payment_data.value.amount = eighteen_months_calc.value;
  if (selectedTerms.value == "24") new_payment_data.value.amount = twenty_four_months_calc.value;
});


watch(
  () => new_payment_data.value.payment_type,
  (newVal, oldVal) => {
    if (newVal == 'Monthly Payment') {
      if (selectedTerms.value == "3") new_payment_data.value.amount = three_months_calc.value;
      if (selectedTerms.value == "6") new_payment_data.value.amount = six_months_calc.value;
      if (selectedTerms.value == "12") new_payment_data.value.amount = twelve_months_calc.value;
      if (selectedTerms.value == "18") new_payment_data.value.amount = eighteen_months_calc.value;
      if (selectedTerms.value == "24") new_payment_data.value.amount = twenty_four_months_calc.value;
    }

    if (newVal == 'Down Payment') {
      new_payment_data.value.amount = down_payment.value
    }
  }
);

watch(
  () => pageViewing.value,
  (newVal, oldVal) => {
    if (newVal == 'ledger') getPayments()
  }
);

async function savePayment() {
  // alert('yawa');
  const { data, error } = await useMyFetch(`/api/customers/${useRoute().params.id}/payments`, {
    method: "post",
    body: {...new_payment_data.value},
  });
  if (error.value) return;
  // console.log(payment.value);

  new_payment_data.value = {
    payment_type: "Monthy Payment",
    amount: 0,
    payment_date: "",
  }
  $toast.fire({
    title: "Payment added!",
    icon: "success",
  });
  getPayments();
}

const search_payment = ref('')
const payments = ref([]);
const balance = ref(0);
async function getPayments() {
  const { data, error } = await useMyFetch(`/api/customers/${useRoute().params.id}/payments`);
  if (error.value) return;
  console.log(data.value);
  payments.value = data.value.payments;
  balance.value = data.value.balance;
}



</script>
