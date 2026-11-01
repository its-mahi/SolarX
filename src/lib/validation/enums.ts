// Canonical SURYAMIT vocabulary (overview §7). Later features import these; never re-declare.
import { z } from "zod";

export const ROLES = ["household", "vendor"] as const;
export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;

export const REQUEST_STATUSES = ["draft", "open", "quoted", "accepted", "closed"] as const;
export const requestStatusSchema = z.enum(REQUEST_STATUSES);
export type RequestStatus = z.infer<typeof requestStatusSchema>;

export const QUOTE_STATUSES = ["submitted", "accepted", "rejected", "withdrawn"] as const;
export const quoteStatusSchema = z.enum(QUOTE_STATUSES);
export type QuoteStatus = z.infer<typeof quoteStatusSchema>;

export const VERIFICATION_STATUSES = ["unverified", "demo"] as const;
export const verificationStatusSchema = z.enum(VERIFICATION_STATUSES);
export type VerificationStatus = z.infer<typeof verificationStatusSchema>;

export const QUOTE_SOURCES = ["manual", "ai_extracted"] as const;
export const quoteSourceSchema = z.enum(QUOTE_SOURCES);
export type QuoteSource = z.infer<typeof quoteSourceSchema>;

export const ROOF_ASSESSMENT_STATUSES = ["completed", "failed"] as const;
export const roofAssessmentStatusSchema = z.enum(ROOF_ASSESSMENT_STATUSES);
export type RoofAssessmentStatus = z.infer<typeof roofAssessmentStatusSchema>;
