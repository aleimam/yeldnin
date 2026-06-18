-- AlterTable
ALTER TABLE "CsEvalType" ADD COLUMN "nameAr" TEXT;

-- AlterTable
ALTER TABLE "CsEvaluationAnswer" ADD COLUMN "criteriaAr" TEXT;
ALTER TABLE "CsEvaluationAnswer" ADD COLUMN "titleAr" TEXT;
ALTER TABLE "CsEvaluationAnswer" ADD COLUMN "typeNameAr" TEXT;

-- AlterTable
ALTER TABLE "CsQuestion" ADD COLUMN "criteriaAr" TEXT;
ALTER TABLE "CsQuestion" ADD COLUMN "tagsAr" TEXT;
ALTER TABLE "CsQuestion" ADD COLUMN "titleAr" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "fullNameAr" TEXT;
ALTER TABLE "User" ADD COLUMN "nameAr" TEXT;
