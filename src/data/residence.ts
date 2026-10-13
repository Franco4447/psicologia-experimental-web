import type { Residence } from '../types/experiment';

/**
 * Options for the residence question: CABA and Provincia de Buenos Aires first
 * (the jurisdictions that satisfy the inclusion criterion), then the remaining
 * provinces in alphabetical order, and 'Otro' last.
 */
export const RESIDENCE_OPTIONS: readonly Residence[] = Object.freeze([
  'Ciudad Autónoma de Buenos Aires',
  'Provincia de Buenos Aires',
  'Catamarca',
  'Chaco',
  'Chubut',
  'Córdoba',
  'Corrientes',
  'Entre Ríos',
  'Formosa',
  'Jujuy',
  'La Pampa',
  'La Rioja',
  'Mendoza',
  'Misiones',
  'Neuquén',
  'Río Negro',
  'Salta',
  'San Juan',
  'San Luis',
  'Santa Cruz',
  'Santa Fe',
  'Santiago del Estero',
  'Tierra del Fuego',
  'Tucumán',
  'Otro',
]);

/** Jurisdictions that satisfy the inclusion criterion. */
export const INCLUDED_RESIDENCES: readonly Residence[] = Object.freeze([
  'Ciudad Autónoma de Buenos Aires',
  'Provincia de Buenos Aires',
]);

export function isValidResidence(value: unknown): value is Residence {
  return typeof value === 'string' && (RESIDENCE_OPTIONS as readonly string[]).includes(value);
}
