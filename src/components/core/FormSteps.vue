<template>
  <div class="form-steps">
    <v-row>
      <v-col class="v-col-s-5 v-col-md-4 v-col-xl-3">
        <v-card class="elevation-2" style="border-radius: 20px !important">
          <div class="steps-container">
            <div v-for="(step, index) in steps" :key="index" class="step-item">
              <div
                class="icon-container"
                :class="{
                  'last-icon': index === steps.length - 1,
                  'completed-step': localCurrentStep > index,
                  'current-step': localCurrentStep === index,
                  'future-step': localCurrentStep < index,
                }"
              >
                <v-icon
                  color="var(--primary-variant)"
                  v-if="localCurrentStep > index"
                  >mdi-check-circle</v-icon
                >
                <v-icon
                  color="var(--primary-variant)"
                  v-else-if="localCurrentStep === index"
                  >mdi-record-circle</v-icon
                >
                <v-icon v-else color="var(--disabled)"
                  >mdi-record-circle</v-icon
                >
                <div
                  v-if="index < steps.length - 1"
                  class="vertical-line"
                ></div>
              </div>
              <div>
                <div class="step-title">{{ step.title }}</div>
                <div class="step-subtitle">{{ step.subtitle }}</div>
              </div>
            </div>
          </div>
        </v-card>
      </v-col>
      <v-col class="v-col-s-7 v-col-md-8 v-col-xl-7">
        <v-card class="elevation-2" style="border-radius: 20px !important">
          <div class="px-3 py-3">
            <slot :name="`step-${localCurrentStep}-title`">
              <v-card-title v-if="steps[localCurrentStep].titleContent">
                <span style="font-size: 1rem">{{
                  steps[localCurrentStep].titleContent
                }}</span>
              </v-card-title>
              <div
                class="ml-4"
                v-if="steps[localCurrentStep].subtitleContent"
                v-html="steps[localCurrentStep].subtitleContent"
                style="
                  word-wrap: break-word;
                  font-size: 0.85rem;
                  color: var(--subtitle);
                  margin-top: -8px;
                "
              ></div>
            </slot>
            <div class="ml-4 mb-2">
              <slot :name="`step-${localCurrentStep}-content`"></slot>
            </div>
          </div>
        </v-card>
        <v-row justify="space-between" class="mt-4 align-end">
          <v-col cols="auto">
            <slot :name="`step-${localCurrentStep}-previous-button`">
              <v-btn
                color="primary"
                v-if="localCurrentStep > 0"
                @click="localCurrentStep--"
                :disabled="disablePreviousButton"
              >
                <v-icon left>mdi-arrow-left</v-icon>
                {{ previousButtonText }}
              </v-btn>
            </slot>
          </v-col>
          <v-col cols="auto">
            <slot :name="`step-${localCurrentStep}-continue-button`">
              <v-btn
                color="primary"
                v-if="localCurrentStep < steps.length - 1"
                @click="localCurrentStep++"
                :disabled="disableNextButton"
              >
                {{ continueButtonText }}
                <v-icon right>mdi-arrow-right</v-icon>
              </v-btn>
            </slot>
          </v-col>
        </v-row>
      </v-col>
    </v-row>
  </div>
</template>

<script>
export default {
  name: 'FormSteps',
  props: {
    steps: {
      type: Array,
      required: true,
      default: () => [],
    },
    previousButtonText: {
      type: String,
      default: 'Previous',
    },
    continueButtonText: {
      type: String,
      default: 'Continue',
    },
    disablePreviousButton: {
      type: Boolean,
      default: false,
    },
    disableNextButton: {
      type: Boolean,
      default: false,
    },
    currentStep: {
      type: Number,
      default: 0,
    },
  },
  data() {
    return {
      localCurrentStep: this.currentStep,
    }
  },
  watch: {
    currentStep(newStep) {
      this.localCurrentStep = newStep
    },
    localCurrentStep(newStep) {
      this.$emit('update:currentStep', newStep)
    },
  },
}
</script>

<style scoped>
.form-steps {
  display: flex;
  justify-content: space-between;
}

.steps-container {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 20px;
  margin-top: 15px;
}

.step-item {
  display: flex;
  align-items: start;
  width: 100%;
  margin-bottom: 20px;
}

.icon-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-right: 10px;
  position: relative;
}

.icon-container::after {
  content: '';
  position: absolute;
  top: 110%;
  left: 50%;
  height: 150%;
  width: 2px;
  background-color: var(--primary-variant) !important;
  transform: translateX(-50%);
}

.icon-container.completed-step::after {
  background-color: var(--title);
}

.icon-container.current-step::after,
.icon-container.future-step::after {
  background-color: var(--disabled) !important;
}

.icon-container.last-icon::after {
  content: none;
}

.step-title {
  font-size: 0.95rem;
  color: var(--title);
  font-weight: 500;
}

.step-subtitle {
  font-size: 0.9rem;
  color: var(--subtitle);
}
</style>
