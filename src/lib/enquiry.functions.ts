import { createServerFn } from "@tanstack/react-start";
import { sendEnquiry, type EnquiryResult } from "@/lib/enquiry";

/** Public contact form. No sign-in. Sends one email to the contact address through Resend. [PLT-019] */
export const submitEnquiry = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }): Promise<EnquiryResult> => sendEnquiry(data, process.env));
