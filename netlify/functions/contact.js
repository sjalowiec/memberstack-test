export default async (req) => {
    try {
      if (req.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
      }
  
      const formData = await req.formData();
  
      const name = formData.get("name");
      const email = formData.get("email");
      const message = formData.get("message");
  
      console.log("CONTACT FORM SUBMISSION:", {
        name,
        email,
        message
      });
  
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
  
    } catch (error) {
      console.error(error);
  
      return new Response(
        JSON.stringify({ success: false }),
        { status: 500 }
      );
    }
  };