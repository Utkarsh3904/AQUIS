import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_NAME = "aquis_user_name";
const KEY_PERSONA = "aquis_persona";
const KEY_COMPLETE = "aquis_onboarding_complete";

export type Persona = "researcher" | "public";

export async function getOnboardingState() {
  const [name, persona, complete] = await AsyncStorage.multiGet([
    KEY_NAME,
    KEY_PERSONA,
    KEY_COMPLETE,
  ]);
  return {
    name: name[1],
    persona: (persona[1] as Persona) || null,
    complete: complete[1] === "true",
  };
}

export async function saveOnboardingName(name: string) {
  await AsyncStorage.setItem(KEY_NAME, name);
}

export async function saveOnboardingPersona(persona: Persona) {
  await AsyncStorage.setItem(KEY_PERSONA, persona);
  await AsyncStorage.setItem(KEY_COMPLETE, "true");
}

export async function resetOnboarding() {
  await AsyncStorage.multiRemove([KEY_NAME, KEY_PERSONA, KEY_COMPLETE]);
}
