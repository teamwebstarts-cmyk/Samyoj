import prisma from '../src/config/database';
import { bootstrapPlatformOperator } from '../src/modules/platform/bootstrap';

function argumentValue(name: string): string | undefined {
  const inline = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);

  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  if (
    process.argv.includes('--password') ||
    process.argv.some((arg) => arg.startsWith('--password='))
  ) {
    throw new Error(
      'Do not put the platform password in shell arguments. Use PLATFORM_OPERATOR_PASSWORD.'
    );
  }

  const email = argumentValue('email') ?? process.env.PLATFORM_OPERATOR_EMAIL;
  const password = process.env.PLATFORM_OPERATOR_PASSWORD;

  if (!email) {
    throw new Error(
      'Operator email is required: --email admin@example.com or PLATFORM_OPERATOR_EMAIL'
    );
  }
  if (!password) {
    throw new Error('PLATFORM_OPERATOR_PASSWORD is required');
  }

  const operator = await bootstrapPlatformOperator({
    email,
    password,
  });

  console.log(
    JSON.stringify(
      {
        created: true,
        operator: {
          id: operator.id,
          email: operator.email,
          role: operator.role,
          mfaEnrollmentRequired: operator.mfaEnabledAt === null,
        },
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
