'use server';
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import postgres from 'postgres';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

// Tipe State untuk menangani validasi error dan pesan dari server
export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};

/* =======================
   ZOD SCHEMA
======================= */
const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({
    invalid_type_error: 'Please select a customer.', // Pesan error kustom
  }),
  amount: z.coerce
    .number()
    .gt(0, { message: 'Please enter an amount greater than $0.' }), // Validasi jumlah > 0
  status: z.enum(['pending', 'paid'], {
    invalid_type_error: 'Please select an invoice status.', // Pesan error kustom
  }),
  date: z.string(),
});

// Skema khusus untuk Create dan Update (menghilangkan field yang tidak diinput user)
const CreateInvoice = FormSchema.omit({ id: true, date: true });
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

/* =======================
   CREATE INVOICE
======================= */
export async function createInvoice(prevState: State, formData: FormData) {
  // 1. Validasi form menggunakan safeParse agar tidak crash jika gagal
  const validatedFields = CreateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  // 2. Jika validasi gagal, kirim error kembali ke form (Client Side)
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Create Invoice.',
    };
  }

  // 3. Ekstraksi data jika sukses
  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = Math.round(amount * 100);
  const date = new Date().toISOString().split('T')[0];

  // 4. Proses Database
  try {
    await sql`
      INSERT INTO invoices (customer_id, amount, status, date)
      VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
    `;
  } catch (error) {
    // Kembalikan pesan error jika database gagal (Accessibility: User tahu apa yang salah)
    return {
      message: 'Database Error: Failed to Create Invoice.',
    };
  }

  // 5. Revalidasi cache dan arahkan kembali ke tabel invoices
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');

}

/* =======================
   UPDATE INVOICE
======================= */
export async function updateInvoice(
  id: string,
  prevState: State, // Ditambahkan untuk Chapter 13
  formData: FormData,
) {
  const validatedFields = UpdateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Update Invoice.',
    };
  }

  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = Math.round(amount * 100);

  try {
    await sql`
      UPDATE invoices
      SET customer_id = ${customerId},
          amount = ${amountInCents},
          status = ${status}
      WHERE id = ${id}
    `;
  } catch (error) {
    return { message: 'Database Error: Failed to Update Invoice.' };
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');

}

/* =======================
   DELETE INVOICE
======================= */
export async function deleteInvoice(id: string) {
  await sql`
    DELETE FROM invoices
    WHERE id = ${id}
  `;

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');

}

export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn('credentials', formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return 'Invalid credentials.';
        default:
          return 'Something went wrong.';
      }
    }
    throw error;
  }
}