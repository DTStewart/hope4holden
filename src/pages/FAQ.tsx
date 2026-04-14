import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  { q: "What is Ataxia Telangiectasia?", a: "A-T is a rare genetic condition that affects the nervous system, immune system, and other body systems. It typically appears in early childhood and progressively affects coordination and movement. Learn more at atcp.org." },
  { q: "Can I register as an individual golfer?", a: "We only accept full team registrations of 4 golfers. If you need help finding a team, contact us and we will do our best to connect you with other golfers." },
  { q: "What does the registration fee include?", a: "The $600 team registration fee includes dinner on Thursday evening at the Victoria Inn and golf on Friday at Glendale Golf Course for all 4 team members." },
  { q: "Are donations tax-deductible?", a: "Yes. Donations are processed through the Ataxia Telangiectasia Children's Project (ATCP), a registered charity, which issues tax receipts on behalf of Hope 4 Holden." },
  { q: "How can I contact the organizers?", a: "Email us at hello@hope4holden.com, or call Jill at 204-761-3880 or Derrick at 204-761-6955." },
  { q: "When and where is the tournament?", a: "The 2026 tournament takes place June 18-19 in Brandon, Manitoba. Thursday dinner is at the Victoria Inn and Friday golf is at Glendale Golf Course." },
  { q: "What is the tournament format?", a: "The tournament is a 4-person team scramble format, making it fun and accessible for golfers of all skill levels." },
  { q: "Can I sponsor the event without playing golf?", a: "Absolutely! You can become a sponsor at any tier without registering a team. Visit our Sponsor page to see available sponsorship packages." },
  { q: "What happens if it rains?", a: "The tournament will proceed rain or shine. In the event of severe weather, we will communicate any schedule changes via email to all registered participants." },
  { q: "Is there a dress code?", a: "Standard golf attire is expected on the course (collared shirts, golf shoes). Thursday dinner is casual — come as you are and enjoy the evening!" },
  { q: "Can I make a donation without attending?", a: "Yes! You can make a one-time or recurring donation on our Donate page. Every dollar goes toward ATCP research to find a cure for A-T." },
  { q: "Where does the money go?", a: "All funds raised through Hope 4 Holden go to the Ataxia Telangiectasia Children's Project (ATCP), which funds research to find a cure and improve the lives of those living with A-T." },
];

const FAQPage = () => {
  return (
    <div>
      <section className="section-dark">
        <div className="container py-20 md:py-28 animate-fade-in">
          <p className="section-label">Questions</p>
          <h1 className="font-heading font-extrabold text-4xl md:text-6xl text-white leading-[0.95]">
            FAQ
          </h1>
          <p className="text-white/60 text-lg mt-6">Everything you need to know about the tournament.</p>
        </div>
      </section>

      <section className="section-light">
        <div className="container py-16 md:py-24 max-w-3xl animate-fade-in">
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border-b border-[#1A1A1A]/10">
                <AccordionTrigger className="text-left font-heading font-bold text-[#1A1A1A] hover:text-primary py-5">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-[#1A1A1A]/60 leading-relaxed pb-5 text-left">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
    </div>
  );
};

export default FAQPage;
