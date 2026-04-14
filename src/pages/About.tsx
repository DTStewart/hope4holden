import { Button } from "@/components/ui/button";
import { Heart, ExternalLink } from "lucide-react";

const AboutPage = () => {
  return (
    <div className="container py-12 md:py-20 max-w-4xl mx-auto space-y-12 animate-fade-in">
      <div className="text-center space-y-4">
        <h1 className="font-heading font-bold text-4xl md:text-5xl">About Holden</h1>
        <p className="text-lg text-muted-foreground">A story of courage, resilience, and hope</p>
      </div>

      <div className="prose prose-lg max-w-none space-y-8">
        <p>
          Holden Stewart is a vibrant and inspiring young boy from Brandon, Manitoba, who faces life
          with a rare genetic disorder known as Ataxia Telangiectasia (A-T). Diagnosed in the fall of
          2021, Holden's journey has been one of courage and resilience, touching all who know him.
        </p>

        <h2 className="font-heading font-bold text-2xl">Diagnosis</h2>
        <p>
          As Holden approached 2 years old, subtle signs began to suggest that something was amiss.
          After a series of (often painful) evaluations, the diagnosis of A-T was confirmed. This
          moment was both sobering and clarifying, marking the beginning of a new chapter for Holden
          and his family.
        </p>

        <h2 className="font-heading font-bold text-2xl">Living with A-T</h2>
        <p>
          Ataxia Telangiectasia affects various aspects of Holden's health, including his mobility and
          speech. Despite these challenges, Holden approaches each day with an infectious optimism and
          an unyielding spirit. His ability to adapt and find joy in the face of adversity is nothing
          short of inspirational.
        </p>
        <p>
          Holden continues to take part in many of the activities that you would expect of a 7 year
          old boy, playing pranks on his siblings, joking around, swimming and playing all kinds of
          games.
        </p>

        <h2 className="font-heading font-bold text-2xl">Family and Community</h2>
        <p>
          The support from Holden's family — his parents Derrick and Jill, along with extended family
          and friends — has been pivotal. They advocate tirelessly not only for Holden but for all
          families navigating the complexities of A-T. The Brandon community has also rallied around
          Holden, embracing him with love and support.
        </p>

        <h2 className="font-heading font-bold text-2xl">A Message from Holden</h2>
        <blockquote className="border-l-4 border-primary pl-6 py-2 italic text-xl bg-primary/5 rounded-r-lg">
          "Beat Disease," Holden often says with a smile. His resilience serves as a beacon of hope
          and strength to everyone he meets.
        </blockquote>
      </div>

      {/* What is A-T */}
      <div className="bg-secondary rounded-xl p-8 space-y-4">
        <h2 className="font-heading font-bold text-2xl">What is Ataxia Telangiectasia?</h2>
        <p className="text-muted-foreground leading-relaxed">
          Ataxia Telangiectasia (A-T) is a rare genetic condition that affects the nervous system,
          immune system, and other body systems. It typically appears in early childhood and
          progressively affects coordination, movement, and other bodily functions. While there is
          currently no cure, research funded by organizations like the ATCP is making progress toward
          better treatments and understanding of the disease.
        </p>
        <Button asChild variant="outline">
          <a href="https://www.atcp.org" target="_blank" rel="noopener noreferrer">
            Learn More at ATCP.org <ExternalLink className="h-4 w-4 ml-2" />
          </a>
        </Button>
      </div>

      {/* Join the Journey */}
      <div className="text-center space-y-6 py-8">
        <Heart className="h-10 w-10 text-primary mx-auto" />
        <h2 className="font-heading font-bold text-3xl">Join the Journey</h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          The Hope for Holden event is more than just a fundraiser — it's a movement of hope and
          solidarity. By participating, you are joining Holden and countless others in the fight
          against Ataxia Telangiectasia, paving the way for a brighter, healthier future.
        </p>
      </div>
    </div>
  );
};

export default AboutPage;
