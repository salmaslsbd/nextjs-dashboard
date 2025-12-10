import postgres from 'postgres';
import { NextResponse } from 'next/server'; // Import NextResponse for better JSON responses

// Ensure your environment variable is set. '!' asserts that the variable is defined.
const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

async function listInvoices() {
  const data = await sql`
    SELECT invoices.amount, customers.name
    FROM invoices
    JOIN customers ON invoices.customer_id = customers.id
    WHERE invoices.amount = 666;
  `;

  return data;
}

export async function GET() {
  try {
    // The query execution is now inside the try block
    const invoices = await listInvoices();
    // Use NextResponse.json for a standard Next.js API route response
    return NextResponse.json(invoices); 
  } catch (error) {
    console.error('Database Error:', error); // Log the error for debugging
    // Return an error response if the query fails
    return NextResponse.json({ 
      message: 'Failed to fetch invoices.', 
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    }, { status: 500 });
  }}