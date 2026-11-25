import { text } from '../../i18n';

const T = text({
  pl: {
    hint: '„Zdjęcia sylwetki” to osobna zgoda na najbardziej osobiste dane: prowadzący zobaczy zaszyfrowane, zmniejszone kopie ostatnich 60 zdjęć z „Sylwetki”. Odznaczenie kasuje je u niego od razu.',
  },
  en: {
    hint: '“Body photos” is a separate consent for your most personal data: the coach sees encrypted, downscaled copies of the latest 60 photos from “Body shape”. Unticking it deletes them on their side at once.',
  },
});

/** Uwaga pod listą zakresów (zaproszenie, strona współpracy): zdjęcia to osobna, najwrażliwsza zgoda. */
export function PhotosHint() {
  return <p className="hint">{T.hint}</p>;
}
