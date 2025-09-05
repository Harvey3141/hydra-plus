<script setup>
import { computed, ref, onMounted } from "vue";
import { useHydraStore } from "@/stores/hydra";

import { showErrorToast } from "@/utils";

import { TYPE_SRC, TYPE_THREE, PARAM_MAPPINGS } from "@/constants";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ChevronDown, ChevronUp, X, Circle, Radio } from "lucide-vue-next";

import NestedDraggable from "@/components/NestedDraggable";

const props = defineProps({
  index: {
    type: Number,
    required: true,
  },
  block: {
    type: Object,
    required: true,
  },
  handleChange: {
    type: Function,
    required: true,
  },
  moveBlock: {
    type: Function,
    required: true,
  },
  openAddBlockModal: {
    type: Function,
    default: () => {},
  },
});

const store = useHydraStore();

const blockHeader = computed(() => {
  return `${props.block.type === TYPE_SRC ? "o" : "s"}${props.index} - ${
    props.block.name
  }`;
});

const isActive = computed(() => store.synthSettings.output === props.index);

const hydra = ref(null);
const cameraNames = ref([]);
const collapsed = ref(false);

const videoRef = ref(null);
const imageRef = ref(null);

onMounted(async () => {
  if (window.hydra) {
    hydra.value = window.hydra;
  }

  if (props.block.name !== "initCam") return;

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = devices.filter(
      (device) => device.kind === "videoinput",
    );

    for (const [i, videoInput] of videoInputs.entries()) {
      cameraNames.value.push(`${i} - ${videoInput.label}`);
    }
  } catch (error) {
    showErrorToast("Error accessing video devices");
  }
});

const toggleCollapsed = () => {
  collapsed.value = !collapsed.value;
};

const showLabel = (blockName) => {
  return blockName !== "initCam" && blockName !== "src";
};

const cut = () => {
  store.setFocus(props.block);
  store.copyBlock(true);
};

const copy = () => {
  store.setFocus(props.block);
  store.copyBlock();
};

const paste = () => {
  store.setFocus(props.block);
  store.pasteBlock();
};

const deleteParent = () => {
  store.deleteParent({
    type: props.block.type,
    index: props.index,
  });
};

const handleVideoError = () => {
  showErrorToast("Invalid video source detected.");

  if (videoRef.value) {
    videoRef.value.removeAttribute("src");
    videoRef.value.load();
  }

  collapsed.value = false;
};

const handleImageError = () => {
  showErrorToast("Invalid image source detected.");

  if (imageRef.value) {
    imageRef.value.removeAttribute("src");
  }

  collapsed.value = false;
};
</script>

<!-- 
  eslint-disable vue/no-mutating-props

  'vue/no-mutating-props' is disabled because the props are not displayed anywhere else in the app.
  The state has to be updated on input change, but the update should be only called when exiting the input focus.
  I consider this applicable in this case.
-->

<template>
  <ContextMenu>
    <ContextMenuTrigger>
      <div
        :id="`${block.type}-${index}`"
        :class="[
          'parent-block',
          block.type,
          `color-${block.colorId % 8}`,
          { focused: store.focused === block },
        ]"
      >
        <div
          class="output-header"
          @mousedown="(e) => moveBlock(e, index, block.type)"
          @touchstart="(e) => moveBlock(e, index, block.type)"
        >
          <div id="drag-handle" class="cursor-grab" />

          {{ blockHeader }}

          <div class="flex items-center gap-2 cursor-pointer">
            <ChevronDown
              v-if="!collapsed"
              :size="16"
              @click="toggleCollapsed"
              @touchstart="toggleCollapsed"
            />
            <ChevronUp
              v-else
              :size="16"
              @click="toggleCollapsed"
              @touchstart="toggleCollapsed"
            />

            <Circle
              v-if="block.type === TYPE_SRC && !isActive"
              :size="16"
              @click="store.setOutput(index)"
              @touchstart="store.setOutput(index)"
            />
            <Radio
              v-if="block.type === TYPE_SRC && isActive"
              :size="16"
              @click="store.setOutput(index)"
              @touchstart="store.setOutput(index)"
            />

            <X :size="16" @click="deleteParent" @touchstart="deleteParent" />
          </div>
        </div>

        <div v-if="!collapsed">
          <div v-if="block.type !== TYPE_THREE">
            <div
              v-for="(param, paramIndex) in block.params"
              :key="paramIndex"
              class="param-container"
            >
              <div class="param flex">
                <Label
                  v-if="showLabel(block.name)"
                  :for="`${block.type}-${index}-${paramIndex}`"
                  class="min-w-24"
                >
                  {{ PARAM_MAPPINGS[block.name][paramIndex] }}
                </Label>

                <Select
                  v-if="block.name === 'initCam'"
                  :id="`${block.type}-${index}-${paramIndex}`"
                  v-model="block.params[paramIndex]"
                  @update:model-value="handleChange"
                >
                  <SelectTrigger class="bg-zinc-900">
                    <SelectValue>
                      {{ cameraNames[block.params[paramIndex]] }}
                    </SelectValue>
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem
                      v-for="(name, camIndex) in cameraNames"
                      :key="'cam' + camIndex"
                      :value="String(camIndex)"
                    >
                      {{ name }}
                    </SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  v-else-if="block.name === 'src'"
                  :id="`${block.type}-${index}-${paramIndex}`"
                  v-model="block.params[paramIndex]"
                  @update:model-value="handleChange"
                >
                  <SelectTrigger class="bg-zinc-900">
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem
                      v-for="(source, sIndex) in store.externalSourceBlocks"
                      :key="`s${sIndex}`"
                      :value="`s${sIndex}`"
                    >
                      s{{ sIndex }} - {{ source.name }}
                    </SelectItem>
                    <SelectItem
                      v-for="(output, oIndex) in store.blocks"
                      :key="`o${oIndex}`"
                      :value="`o${oIndex}`"
                    >
                      o{{ oIndex }} - {{ output.name }}
                    </SelectItem>
                  </SelectContent>
                </Select>

                <Input
                  v-else
                  :id="`${block.type}-${index}-${paramIndex}`"
                  v-model="block.params[paramIndex]"
                  class="bg-zinc-900 my-0"
                  @focusin="store.setInputFocus(true)"
                  @focusout="handleChange()"
                />
              </div>

              <div v-if="block.type !== TYPE_SRC" v-show="!collapsed">
                <img
                  v-if="block.name === 'initImage'"
                  :src="block.params[paramIndex]"
                  @error="handleImageError"
                />

                <video
                  v-else-if="block.name === 'initVideo'"
                  :src="block.params[paramIndex]"
                  autoplay
                  muted
                  loop
                  @error="handleVideoError"
                />

                <video
                  v-else-if="
                    block.name === 'initCam' || block.name === 'initScreen'
                  "
                  :srcObject="hydra[`s${index}`].src?.srcObject"
                  :class="block.name"
                  autoplay
                  muted
                />
              </div>

              <!-- @todo 3D preview -->
            </div>
          </div>

          <NestedDraggable
            v-if="block.blocks"
            :parent="block"
            :handle-change="handleChange"
            :open-add-block-modal="openAddBlockModal"
            :path="index.toString()"
          />
        </div>
      </div>
    </ContextMenuTrigger>
    <ContextMenuContent>
      <ContextMenuCheckboxItem
        :checked="isActive"
        @click="store.setOutput(index)"
      >
        Set active output
      </ContextMenuCheckboxItem>
      <ContextMenuSeparator />
      <ContextMenuItem @click="openAddBlockModal(block)">
        New effect
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem @click="cut">Cut</ContextMenuItem>
      <ContextMenuItem @click="copy">Copy</ContextMenuItem>
      <ContextMenuItem @click="paste">Paste</ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem @click="deleteParent">Delete</ContextMenuItem>
    </ContextMenuContent>
  </ContextMenu>
</template>

<style lang="scss" scoped>
// @todo clean this mess up 😭

@use "@/assets/styles/variables" as *;

$spacing: 8px;

.parent-block {
  position: absolute;
  display: flex;
  overflow: hidden;
  width: min(360px, 80%);
  flex-direction: column;
  border-radius: 0 $border-radius 0 $border-radius;
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
  background: #222222aa;
  box-shadow: 0 3px 12px #00000080;

  .output-header {
    display: flex;
    justify-content: space-between;
    padding: $spacing;
    border-radius: 0 $border-radius 0 0;
    background: #fff;
    color: #000;
    cursor: move;
    font-weight: bold;
    -webkit-user-select: none;
    user-select: none;
  }

  .param-container {
    .param {
      padding: calc($spacing / 4) $spacing;
    }

    &:first-of-type .param {
      padding-top: $spacing;
    }

    &:last-of-type .param {
      padding-bottom: $spacing;
    }

    label {
      display: flex;
      align-items: center;
    }
  }

  &.source {
    --offset-top: -300%;
    --color: #ffffff;
    --bottom-color: #38383890;
    --offset-bottom: 150%;

    @mixin block-colors {
      background: linear-gradient(
        180deg,
        var(--color) var(--offset-top),
        var(--bottom-color) var(--offset-bottom)
      );

      &.focused {
        background: linear-gradient(
          180deg,
          var(--color) calc(var(--offset-top) / 2),
          var(--bottom-color) calc(var(--offset-bottom) * 2)
        );
      }

      .output-header {
        background: var(--color);
      }
    }

    &.color-0 {
      --color: theme(colors.yellow.200);
      @include block-colors();
    }

    &.color-1 {
      --color: theme(colors.green.300);
      @include block-colors();
    }

    &.color-2 {
      --color: theme(colors.blue.300);
      @include block-colors();
    }

    &.color-3 {
      --color: theme(colors.pink.300);
      @include block-colors();
    }

    &.color-4 {
      --color: theme(colors.purple.300);
      @include block-colors();
    }

    &.color-5 {
      --color: theme(colors.orange.300);
      @include block-colors();
    }

    &.color-6 {
      --color: theme(colors.emerald.100);
      @include block-colors();
    }

    &.color-7 {
      --color: theme(colors.indigo.400);
      @include block-colors();
    }
  }

  &.external {
    .output-header {
      --color: theme(colors.red.300);
      background: var(--color);
    }

    img,
    video {
      width: 100%;
      max-height: 200px;
      object-fit: cover;
    }
  }
}

input {
  font-family: "Fira Code", monospace;
  font-size: 0.8em;
}
</style>
