import { User } from '../../prisma/methods';
import { prisma } from '../../prisma';

export async function checkCodeService({ email, code }: any) {
  const user = await prisma.user.findFirst({
    where: {
      email: email.toLowerCase(),
      code,
    },
  });

  return User(user)?.toJSON(); // Assuming you want to return the user if found
}
