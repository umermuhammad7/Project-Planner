import "fastify";

declare module "fastify" {
  interface FastifyRequest {
    currentUser?: {
      id: string;
      email: string;
    };
    childDevice?: {
      id: string;
      familyId: string;
      memberId: string;
      deviceToken: string;
    };
  }
}
