import { Redirect } from "expo-router";
import { useAuth } from "../src/context/AuthContext";

export default function Index() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    // You could show a loading screen here
    return null;
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)/feed" />;
  } else {
    return <Redirect href="/(auth)/login" />;
  }
}
