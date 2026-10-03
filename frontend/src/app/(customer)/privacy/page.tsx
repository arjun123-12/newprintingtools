import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import { ShieldCheck, ChevronRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy | ERRY IMPRINTS',
  description:
    'This Privacy Policy outlines how ERRY IMPRINTS collects, uses, discloses, and safeguards your information when you visit www.erryimprints.com.au and use our printing services.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-slate-50 min-h-screen py-10 lg:py-16 text-slate-800">
      {/* Breadcrumb Navigation */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
        <nav className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <Link href="/" className="hover:text-blue-600 transition-colors">
            Home
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-900">Privacy Policy</span>
        </nav>
      </div>

      {/* Hero Header */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
        <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-8 sm:p-10 shadow-xl border border-slate-800">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>ERRY IMPRINTS Privacy</span>
            </span>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              Privacy Policy
            </h1>
            <div className="text-slate-300 text-xs sm:text-sm space-y-1">
              <p>Effective Date: 29 October, 2025</p>
              <p>Last Updated: 29 October, 2025</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content Container */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white p-6 sm:p-12 rounded-3xl border border-slate-200 shadow-xs space-y-8 text-sm leading-relaxed text-slate-700">
          {/* 1. Introduction */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">1. Introduction</h2>
            <p>
              Welcome to ERRY IMPRINTS. We are committed to protecting the privacy and security of your personal information. This Privacy Policy outlines how we collect, use, disclose, and safeguard your information when you visit our website www.erryimprints.com.au and use our printing services
            </p>
            <p>
              By using our Site and Services, you agree to the collection and use of information in accordance with this policy.
            </p>
          </div>

          {/* 2. Information We Collect */}
          <div className="space-y-4 pt-6 border-t border-slate-100">
            <h2 className="text-lg font-bold text-slate-900">2. Information We Collect</h2>
            <p>
              We may collect information about you in a variety of ways. The information we may collect on the Site includes:
            </p>

            <div className="space-y-3 pl-2 sm:pl-4">
              <h3 className="font-bold text-slate-900">a) Personal Data You Provide to Us:</h3>
              <p>
                <strong>Account Information:</strong> When you register for an account, we collect your name, email address, password, and phone number.
              </p>
              <p>
                <strong>Order Information:</strong> When you place an order, we collect your shipping address, billing address, and contact details.
              </p>
              <p>
                <strong>Payment Information:</strong> We collect payment details necessary to process your order, such as credit card numbers or other payment account information. This data is processed securely by our commonwealth bank payment gateways and we do not store your full credit card number on our servers.
              </p>
              <p>
                <strong>Communications:</strong> If you contact us directly for customer support or inquiries, we will collect your name, email address, and the contents of your message.
              </p>
            </div>

            <div className="space-y-3 pl-2 sm:pl-4 pt-2">
              <h3 className="font-bold text-slate-900">b) Your Uploaded Content:</h3>
              <p>
                <strong>Designs, Files, and Images:</strong> We collect the files, designs, photographs, documents, and other content you upload to our Site for the purpose of fulfilling your printing order. Your Content is treated as highly sensitive information.
              </p>
            </div>

            <div className="space-y-3 pl-2 sm:pl-4 pt-2">
              <h3 className="font-bold text-slate-900">c) Data We Collect Automatically:</h3>
              <p>
                <strong>Log and Usage Data:</strong> Like most websites, we automatically collect information your browser sends whenever you visit our Site. This may include your IP address, browser type and version, the pages you visit, the time and date of your visit, and other diagnostic data.
              </p>
              <p>
                <strong>Cookies and Tracking Technologies:</strong> We use cookies and similar tracking technologies to track activity on our Site and hold certain information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. However, if you do not accept cookies, you may not be able to use some portions of our Service.
              </p>
            </div>
          </div>

          {/* 3. How We Use Your Information */}
          <div className="space-y-3 pt-6 border-t border-slate-100">
            <h2 className="text-lg font-bold text-slate-900">3. How We Use Your Information</h2>
            <p>We use the information we collect for the following purposes:</p>
            <p>
              <strong>To Provide and Manage Our Services:</strong> To create and manage your account, process transactions, and fulfill your printing orders.
            </p>
            <p>
              <strong>To Process Your Content:</strong> To use the files and designs you upload for the sole purpose of printing and delivering your order as requested. We will not use Your Content for any other purpose without your explicit consent.
            </p>
            <p>
              <strong>To Communicate With You:</strong> To respond to your comments and questions, provide customer support, and send you order confirmations, invoices, and other service-related announcements.
            </p>
            <p>
              <strong>For Marketing and Promotions:</strong> With your consent, to send you marketing emails about new products, special offers, and other news. You can opt-out of these communications at any time.
            </p>
            <p>
              <strong>To Improve Our Site and Services:</strong> To monitor and analyze usage and trends to improve your experience on our Site.
            </p>
            <p>
              <strong>For Security and Legal Compliance:</strong> To protect the security and integrity of our Site, prevent fraud, and comply with our legal obligations.
            </p>
          </div>

          {/* 4. Sharing and Disclosure of Your Information */}
          <div className="space-y-3 pt-6 border-t border-slate-100">
            <h2 className="text-lg font-bold text-slate-900">4. Sharing and Disclosure of Your Information</h2>
            <p>
              We do not sell your personal information. We may share your information with third parties only in the ways that are described in this Privacy Policy:
            </p>
            <p>
              <strong>Third-Party Service Providers:</strong> We share information with trusted third parties who perform services for us or on our behalf, such as payment processing , shipping and delivery web hosting, data analysis, and email delivery.
            </p>
            <p>
              <strong>Legal Requirements:</strong> We may disclose your information if required to do so by law or in the good faith belief that such action is necessary to comply with a legal obligation, protect and defend our rights or property, or protect the personal safety of users or the public.
            </p>
            <p>
              <strong>Business Transfers:</strong> In the event of a merger, acquisition, or sale of all or a portion of our assets, your personal information may be transferred.
            </p>
            <p className="font-semibold text-slate-900">
              We will not share, sell, or use Your Content for any purpose other than fulfilling your order.
            </p>
          </div>

          {/* 5. Data Security */}
          <div className="space-y-3 pt-6 border-t border-slate-100">
            <h2 className="text-lg font-bold text-slate-900">5. Data Security</h2>
            <p>
              We implement a variety of security measures to maintain the safety of your personal information. We use industry-standard encryption (SSL/TLS) to protect data transmissions. However, no method of transmission over the Internet or method of electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your personal information, we cannot guarantee its absolute security.
            </p>
          </div>

          {/* 6. Data Retention */}
          <div className="space-y-3 pt-6 border-t border-slate-100">
            <h2 className="text-lg font-bold text-slate-900">6. Data Retention</h2>
            <p>
              We will retain your personal information only for as long as is necessary for the purposes set out in this Privacy Policy. We will retain and use your information to the extent necessary to comply with our legal obligations, resolve disputes, and enforce our legal agreements and policies.
            </p>
            <p>
              Your Content uploaded for printing orders may be retained for a limited period to facilitate re-orders or resolve any production issues, after which it will be securely deleted from our active servers.
            </p>
          </div>

          {/* 7. Your Rights */}
          <div className="space-y-3 pt-6 border-t border-slate-100">
            <h2 className="text-lg font-bold text-slate-900">7. Your Rights</h2>
            <p>
              In accordance with the Australian Privacy Principles (APPs) and other applicable privacy laws, you have the right to:
            </p>
            <p>
              <strong>Access:</strong> Request access to the personal information we hold about you.
            </p>
            <p>
              <strong>Correction:</strong> Request the correction of any inaccurate or incomplete personal information.
            </p>
            <p>
              <strong>Deletion:</strong> Request the deletion of your personal information, subject to certain legal exceptions.
            </p>
            <p>
              <strong>Opt-out:</strong> Unsubscribe from our marketing communications at any time by clicking the “unsubscribe” link in the emails we send.
            </p>
            <p>
              To exercise these rights, please contact us using the details provided below.
            </p>
          </div>

          {/* 8. Cookies Policy */}
          <div className="space-y-3 pt-6 border-t border-slate-100">
            <h2 className="text-lg font-bold text-slate-900">8. Cookies Policy</h2>
            <p>We use cookies to enhance your experience.</p>
            <p>
              <strong>Essential Cookies:</strong> Necessary for the website to function, such as keeping you logged in or keeping items in your shopping cart.
            </p>
            <p>
              <strong>Analytics Cookies:</strong> Help us understand how visitors interact with our website.
            </p>
            <p>
              <strong>Marketing Cookies:</strong> Used to display relevant ads to you.
            </p>
            <p>
              You can manage your cookie preferences through your browser settings.
            </p>
          </div>

          {/* 9. Children’s Privacy */}
          <div className="space-y-3 pt-6 border-t border-slate-100">
            <h2 className="text-lg font-bold text-slate-900">9. Children’s Privacy</h2>
            <p>
              Our Services are not directed to anyone under the age of 16. We do not knowingly collect personally identifiable information from children under 16. If we become aware that we have collected personal data from a child without verification of parental consent, we will take steps to remove that information from our servers.
            </p>
          </div>

          {/* 10. Changes to This Privacy Policy */}
          <div className="space-y-3 pt-6 border-t border-slate-100">
            <h2 className="text-lg font-bold text-slate-900">10. Changes to This Privacy Policy</h2>
            <p>
              We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the “Last Updated” date. You are advised to review this Privacy Policy periodically for any changes.
            </p>
          </div>

          {/* 11. Contact Us */}
          <div className="space-y-3 pt-6 border-t border-slate-100">
            <h2 className="text-lg font-bold text-slate-900">11. Contact Us</h2>
            <p>
              If you have any questions, concerns, or complaints about this Privacy Policy or our data-handling practices, please contact us at:
            </p>
            <p className="font-semibold text-slate-900">
              <a href="mailto:Info@erryimprints.com.au" className="text-blue-600 hover:underline">
                Info@erryimprints.com.au
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
