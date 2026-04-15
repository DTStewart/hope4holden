import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const SponsorRedirect = () => {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/register#sponsor", { replace: true });
  }, [navigate]);
  return null;
};

export default SponsorRedirect;
