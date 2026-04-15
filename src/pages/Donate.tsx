import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const DonateRedirect = () => {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/register#donate", { replace: true });
  }, [navigate]);
  return null;
};

export default DonateRedirect;
