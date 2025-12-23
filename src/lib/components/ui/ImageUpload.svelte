<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import {
    uploadImage,
    validateImage,
    createPreviewUrl,
    revokePreviewUrl,
    type ImageUploadResult
  } from '$lib/utils/imageUpload';
  import { authStore } from '$lib/stores/auth';

  export let category: 'avatar' | 'message' | 'channel' = 'message';
  export let currentUrl: string | null = null;
  export let maxSizeMB = 5;
  export let accept = 'image/jpeg,image/png,image/webp,image/gif';

  const dispatch = createEventDispatcher<{
    upload: ImageUploadResult;
    error: string;
  }>();

  let fileInput: HTMLInputElement;
  let dragOver = false;
  let uploading = false;
  let previewUrl: string | null = null;
  let error: string | null = null;
  let uploadProgress = 0;

  $: displayUrl = previewUrl || currentUrl;
  $: isAvatar = category === 'avatar';

  async function handleFile(file: File) {
    error = null;

    // Validate file size
    if (file.size > maxSizeMB * 1024 * 1024) {
      error = `File too large. Maximum size is ${maxSizeMB}MB`;
      dispatch('error', error);
      return;
    }

    // Validate image
    const validation = await validateImage(file);
    if (!validation.valid) {
      error = validation.error || 'Invalid image';
      dispatch('error', error);
      return;
    }

    // Show preview
    if (previewUrl) {
      revokePreviewUrl(previewUrl);
    }
    previewUrl = createPreviewUrl(file);

    // Upload
    uploading = true;
    uploadProgress = 0;

    try {
      const pubkey = $authStore.publicKey || 'anonymous';
      const result = await uploadImage(file, pubkey, category);

      if (result.success) {
        dispatch('upload', result);
      } else {
        error = result.error || 'Upload failed';
        dispatch('error', error);
        // Revert preview on error
        if (previewUrl) {
          revokePreviewUrl(previewUrl);
          previewUrl = null;
        }
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Upload failed';
      dispatch('error', error);
    } finally {
      uploading = false;
      uploadProgress = 100;
    }
  }

  function handleInputChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      handleFile(file);
    }
    // Reset input so same file can be selected again
    input.value = '';
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;

    const file = e.dataTransfer?.files[0];
    if (file && file.type.startsWith('image/')) {
      handleFile(file);
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    dragOver = true;
  }

  function handleDragLeave() {
    dragOver = false;
  }

  function triggerFileInput() {
    fileInput?.click();
  }

  function clearImage() {
    if (previewUrl) {
      revokePreviewUrl(previewUrl);
      previewUrl = null;
    }
    dispatch('upload', { success: true, url: '' });
  }
</script>

<div class="image-upload" class:is-avatar={isAvatar}>
  <input
    type="file"
    bind:this={fileInput}
    {accept}
    on:change={handleInputChange}
    class="hidden"
  />

  <!-- Drop zone / Preview area -->
  <div
    class="drop-zone"
    class:drag-over={dragOver}
    class:has-image={!!displayUrl}
    class:uploading
    on:drop={handleDrop}
    on:dragover={handleDragOver}
    on:dragleave={handleDragLeave}
    on:click={triggerFileInput}
    role="button"
    tabindex="0"
    on:keydown={(e) => e.key === 'Enter' && triggerFileInput()}
  >
    {#if displayUrl}
      <img src={displayUrl} alt="Preview" class="preview-image" />
      {#if !uploading}
        <div class="overlay">
          <span class="overlay-text">Click to change</span>
        </div>
      {/if}
    {:else}
      <div class="placeholder">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="icon">
          <path
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <span class="placeholder-text">
          {#if isAvatar}
            Upload avatar
          {:else}
            Drop image here or click to upload
          {/if}
        </span>
        <span class="size-hint">Max {maxSizeMB}MB</span>
      </div>
    {/if}

    {#if uploading}
      <div class="upload-overlay">
        <span class="loading loading-spinner loading-md"></span>
        <span class="upload-text">Uploading...</span>
      </div>
    {/if}
  </div>

  <!-- Error message -->
  {#if error}
    <div class="error-message">
      <svg xmlns="http://www.w3.org/2000/svg" class="error-icon" fill="none" viewBox="0 0 24 24">
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <span>{error}</span>
    </div>
  {/if}

  <!-- Clear button -->
  {#if displayUrl && !uploading}
    <button class="btn btn-ghost btn-xs mt-2" on:click|stopPropagation={clearImage}>
      Remove image
    </button>
  {/if}
</div>

<style>
  .image-upload {
    @apply flex flex-col items-center;
  }

  .drop-zone {
    @apply relative cursor-pointer rounded-lg border-2 border-dashed border-base-300
           transition-all duration-200 overflow-hidden;
    @apply hover:border-blue-500 hover:bg-base-200/50;
    width: 100%;
    min-height: 150px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .is-avatar .drop-zone {
    @apply rounded-full;
    width: 120px;
    height: 120px;
    min-height: auto;
  }

  .drag-over {
    @apply border-blue-500 bg-blue-500/10;
  }

  .has-image {
    @apply border-solid border-base-300;
  }

  .preview-image {
    @apply w-full h-full object-cover;
  }

  .overlay {
    @apply absolute inset-0 bg-black/50 opacity-0 transition-opacity duration-200
           flex items-center justify-center;
  }

  .drop-zone:hover .overlay {
    @apply opacity-100;
  }

  .overlay-text {
    @apply text-white font-medium text-sm;
  }

  .placeholder {
    @apply flex flex-col items-center justify-center text-base-content/60 p-4;
  }

  .icon {
    @apply w-10 h-10 mb-2;
  }

  .is-avatar .icon {
    @apply w-8 h-8;
  }

  .placeholder-text {
    @apply text-sm text-center;
  }

  .size-hint {
    @apply text-xs text-base-content/40 mt-1;
  }

  .upload-overlay {
    @apply absolute inset-0 bg-base-100/80 flex flex-col items-center justify-center;
  }

  .upload-text {
    @apply text-sm mt-2;
  }

  .error-message {
    @apply flex items-center gap-2 text-error text-sm mt-2;
  }

  .error-icon {
    @apply w-4 h-4 flex-shrink-0;
  }

  .hidden {
    display: none;
  }
</style>
