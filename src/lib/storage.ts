import { supabase } from './supabase'

const RECEIPTS_BUCKET = 'receipts'
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']

export interface UploadReceiptResult {
  path: string
  error?: string
}

/**
 * Upload a receipt file to Supabase Storage
 * Path format: {userId}/YYYY/MM/{uuid}.{ext}
 */
export async function uploadReceipt(
  file: File,
  userId: string
): Promise<UploadReceiptResult> {
  try {
    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return {
        path: '',
        error: 'Invalid file type. Only JPG, PNG, and PDF files are allowed.'
      }
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return {
        path: '',
        error: 'File size exceeds 5MB limit.'
      }
    }

    // Generate path with date hierarchy
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const uuid = crypto.randomUUID()
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${userId}/${year}/${month}/${uuid}.${ext}`

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(RECEIPTS_BUCKET)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      return {
        path: '',
        error: uploadError.message
      }
    }

    return { path }
  } catch (error: any) {
    return {
      path: '',
      error: error.message || 'Failed to upload receipt'
    }
  }
}

/**
 * Get a signed URL for viewing a receipt
 * Valid for 1 hour (3600 seconds)
 */
export async function getReceiptUrl(path: string): Promise<string | null> {
  try {
    if (!path) return null

    const { data, error } = await supabase.storage
      .from(RECEIPTS_BUCKET)
      .createSignedUrl(path, 3600) // 1 hour TTL

    if (error) {
      console.error('Error creating signed URL:', error)
      return null
    }

    return data.signedUrl
  } catch (error) {
    console.error('Error getting receipt URL:', error)
    return null
  }
}

/**
 * Delete a receipt from storage
 */
export async function deleteReceipt(path: string): Promise<{ error?: string }> {
  try {
    if (!path) return {}

    const { error } = await supabase.storage
      .from(RECEIPTS_BUCKET)
      .remove([path])

    if (error) {
      return { error: error.message }
    }

    return {}
  } catch (error: any) {
    return { error: error.message || 'Failed to delete receipt' }
  }
}
