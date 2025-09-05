<script setup>
import { ref, watch, computed } from "vue";
import { useHydraStore } from "@/stores/hydra";
import { showErrorToast } from "@/utils";
import { useToast } from "@/components/ui/toast/use-toast";

import BaseModal from "./BaseModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const props = defineProps({
  sceneId: {
    type: String,
    required: true,
  },
});

const emit = defineEmits(["close"]);

const store = useHydraStore();

const { toast } = useToast();

const newName = ref("");

const scene = computed(() => {
  return store.scenes.find((s) => s.id === props.sceneId);
});

// Set initial name when modal opens
watch(
  () => props.sceneId,
  (newSceneId) => {
    if (newSceneId && scene.value) {
      newName.value = scene.value.name;
    }
  },
  { immediate: true },
);

const renameScene = () => {
  if (!newName.value.trim()) {
    showErrorToast("Scene name cannot be empty");
    return;
  }

  if (newName.value.length > 25) {
    showErrorToast("Scene name cannot be longer than 25 characters");
    return;
  }

  const trimmedName = newName.value.trim();

  if (scene.value && scene.value.name !== trimmedName) {
    store.renameScene(props.sceneId, trimmedName);
    toast({
      title: "Scene renamed",
      description: `Scene renamed to "${trimmedName}"`,
    });
  }

  emit("close");
};

const cancel = () => {
  emit("close");
};

const handleKeydown = (event) => {
  if (event.key === "Enter") {
    renameScene();
  } else if (event.key === "Escape") {
    cancel();
  }
};
</script>

<template>
  <BaseModal modal-name="RenameSceneModal" @close="cancel">
    <div class="flex flex-col space-y-5 w-full">
      <div class="space-y-2">
        <Label for="scene-name">Enter a new name for "{{ scene?.name }}"</Label>
        <Input
          id="scene-name"
          v-model="newName"
          class="bg-zinc-900"
          placeholder="Enter scene name..."
          @keydown="handleKeydown"
        />
      </div>

      <div class="flex space-x-3 items-center justify-center">
        <Button variant="outline" @click="cancel">Cancel</Button>
        <Button :disabled="!newName.trim()" @click="renameScene">
          Rename Scene
        </Button>
      </div>
    </div>
  </BaseModal>
</template>
