import { create } from 'zustand'

const INITIAL_STATE = {
  fullName: '',
  dob: '',
  gender: '',
  phone: '',
  nationality: '',
  country: '',
  city: '',
  preferredLanguage: 'fr',
  emergencyContactName: '',
  emergencyContactPhone: '',
  email: '',
  password: '',
  confirmPassword: '',
  twoFactorLater: true,
  consent: false,
}

export const useRegistrationStore = create((set) => ({
  ...INITIAL_STATE,
  setField: (field, value) => set({ [field]: value }),
  reset: () => set({ ...INITIAL_STATE }),
}))
