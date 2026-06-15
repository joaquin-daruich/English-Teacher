
const API_URL = import.meta.env.VITE_API_URL

    

export const commentTest = async () => {
  const res =  await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: "Hello from frontend"
    })
  });

  const data = await res.json();
  console.log(data);
};