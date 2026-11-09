// Stands in for libheif-js (LGPL-3.0), which K.G.B. does not ship until the owner decides on it (D-071,
// plan 12.3): the copied window then says plainly that .heic photos cannot be read here.
const refuse = () => {
  throw new Error("Pozele .heic nu se pot citi aici: salvează poza ca .jpg și încearcă din nou.");
};

export default refuse;
export const HeifDecoder = refuse;
